// The public router.
//
// Hono, not a framework: a route is a function from a request to a string, and the whole
// page cache is one Map (Invariant 1). What was ISR plus a tagged data cache plus a
// per-write path superset is now "render it, keep the string, throw all of them away on
// any write".
//
// Route order is load-bearing. `/:slug` matches anything, so every fixed path is
// registered before it; Hono matches in registration order.

import { Hono } from 'hono'
import { getPublicPosts, searchPosts } from '@/content/posts'
import { getPublicPages } from '@/content/pages'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { resolveSeries } from '@/content/series'
import { resolveTerm } from '@/content/taxonomy'
import { paginate } from '@/content/paginate'
import { t } from '@/i18n/i18n'
import { pageCache } from '@/server/cache'
import { renderDocument, pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'
import { renderListing } from '@/web/listing'
import { renderFeed, renderLlms, renderRobots, renderSitemap } from '@/web/feeds'
import { renderArticle } from '@/web/article'
import { assetBody } from '@/web/assets'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Wrap listing markup in the site shell. Shared by home, taxonomy, series and search. */
async function listingPage(
  title: string, body: string, canonicalPath?: string,
): Promise<string> {
  const settings = await getSettings()
  const site = resolveSiteUrl(settings)
  return renderDocument(
    settings,
    {
      title,
      description: settings.description,
      canonical: site && canonicalPath !== undefined ? `${site}${canonicalPath}` : undefined,
    },
    pageStyles(settings, PUBLIC_CSS),
    `<div class="wrap">
<header class="site"><a class="title" href="/">${escapeHtml(settings.title)}</a>${
      settings.showDescription && settings.description
        ? `<p class="tagline">${escapeHtml(settings.description)}</p>` : ''
    }</header>
<main>${body}</main>
</div>`,
  )
}

/** A page number from the URL. Anything that is not a positive integer is a 404, not a 1. */
function pageNumber(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

export function createApp(): Hono {
  const app = new Hono()

  // Cached HTML routes go through here so the cache rule lives in ONE place.
  const cached = (key: string, render: () => Promise<string | null>) => async () => {
    const hit = pageCache.get(key)
    if (hit !== undefined) return new Response(hit, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    const html = await render()
    if (html === null) return new Response('Not found', { status: 404 })
    pageCache.set(key, html)
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }

  const home = async (page: number) => {
    const settings = await getSettings()
    const paged = paginate(await getPublicPosts(), page, settings.postsPerPage)
    // `paginate` CLAMPS an out-of-range page, so an emptiness check never fires: /page/9
    // would silently serve the last page under a ninth URL, which is duplicate content
    // at every number a crawler tries. Compare against the real total instead.
    if (page > paged.totalPages) return null
    return listingPage(
      page === 1 ? settings.title : `${settings.title} · page ${page}`,
      renderListing({ paged, basePath: '', empty: t(settings.language).emptyPosts }, settings),
      page === 1 ? '/' : `/page/${page}`,
    )
  }

  app.get('/', async () => cached('/', () => home(1))())

  app.get('/page/:n', async (c) => {
    const page = pageNumber(c.req.param('n'))
    if (page === null) return c.text('Not found', 404)
    return cached(`/page/${page}`, () => home(page))()
  })

  // ----- taxonomy -------------------------------------------------------------

  // The route segment is singular ('category'), the data field is plural ('categories'):
  // the URL shape is the frozen tree's and so is the field name, so the map lives here.
  const TAXONOMIES = [
    { segment: 'category', field: 'categories' },
    { segment: 'tag', field: 'tags' },
  ] as const
  for (const { segment: kind, field } of TAXONOMIES) {
    const term = async (slug: string, page: number) => {
      const settings = await getSettings()
      const { name, posts } = resolveTerm(await getPublicPosts(), field, slug)
      if (!name) return null
      const paged = paginate(posts, page, settings.postsPerPage)
      if (page > paged.totalPages) return null // see the home route
      return listingPage(
        `${name} · ${settings.title}`,
        renderListing({
          heading: name,
          subheading: `${posts.length} post${posts.length === 1 ? '' : 's'}`,
          paged, basePath: `/${kind}/${slug}`,
          empty: kind === 'category' ? t(settings.language).emptyCategory : t(settings.language).emptyTag,
        }, settings),
        `/${kind}/${slug}`,
      )
    }

    app.get(`/${kind}/:slug`, async (c) =>
      cached(`/${kind}/${c.req.param('slug')}`, () => term(c.req.param('slug'), 1))())

    app.get(`/${kind}/:slug/page/:n`, async (c) => {
      const page = pageNumber(c.req.param('n'))
      if (page === null) return c.text('Not found', 404)
      const slug = c.req.param('slug')
      return cached(`/${kind}/${slug}/page/${page}`, () => term(slug, page))()
    })
  }

  // ----- series ---------------------------------------------------------------

  app.get('/series/:slug', async (c) => {
    const slug = c.req.param('slug')
    return cached(`/series/${slug}`, async () => {
      const settings = await getSettings()
      const { name, posts } = await resolveSeries(slug)
      if (!name) return null
      // A series is read in order, front to back: it is not paginated.
      return listingPage(
        `${name} · ${settings.title}`,
        renderListing({
          heading: name,
          subheading: `${posts.length} part${posts.length === 1 ? '' : 's'}`,
          paged: { items: posts, page: 1, totalPages: 1 },
          basePath: `/series/${slug}`, empty: t(settings.language).emptySeries,
        }, settings),
        `/series/${slug}`,
      )
    })()
  })

  // ----- search ---------------------------------------------------------------
  // Server-rendered, and therefore NOT cached: the key would be the query string, which
  // is unbounded, and a cache an anonymous visitor can fill is a memory leak with a nicer
  // name. FTS5 makes the read cheap enough that it does not need one.

  app.get('/search', async (c) => {
    const settings = await getSettings()
    const q = (c.req.query('q') ?? '').trim().slice(0, 200)
    const results = q ? await searchPosts(q) : []
    const body = renderListing({
      heading: t(settings.language).search,
      subheading: q ? `${results.length} result${results.length === 1 ? '' : 's'} for "${q}"` : undefined,
      paged: { items: results, page: 1, totalPages: 1 },
      basePath: '/search',
      empty: q ? t(settings.language).searchEmpty : t(settings.language).searchHint,
    }, settings)
    const form = `<form class="search" action="/search" method="get" role="search">
<input type="search" name="q" value="${escapeHtml(q)}" aria-label="${escapeHtml(t(settings.language).search)}">
<button type="submit">${escapeHtml(t(settings.language).search)}</button>
</form>`
    return c.html(await listingPage(`${t(settings.language).search} · ${settings.title}`, form + body))
  })

  // ----- browser bundles ------------------------------------------------------
  // The URL carries a content hash, so the answer is cacheable forever and a deploy that
  // changes the code changes the URL. A miss is a 404, never a stale body: an unknown
  // hash means the reader is asking for a version this server does not have.

  app.get('/assets/:file', (c) => {
    const body = assetBody(`/assets/${c.req.param('file')}`)
    if (body === null) return c.text('Not found', 404)
    return new Response(body, {
      headers: {
        'content-type': 'text/javascript; charset=utf-8',
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  })

  // ----- machine-readable -----------------------------------------------------

  const feedRoute = (
    path: string,
    enabled: (s: Awaited<ReturnType<typeof getSettings>>) => boolean,
    type: string,
    build: (args: {
      posts: Awaited<ReturnType<typeof getPublicPosts>>
      pages: Awaited<ReturnType<typeof getPublicPages>>
      settings: Awaited<ReturnType<typeof getSettings>>
      site: string
    }) => string,
  ) => {
    app.get(path, async (c) => {
      const settings = await getSettings()
      // A disabled feed 404s rather than serving an empty document: an empty feed looks
      // like a broken site to an aggregator, a 404 looks like what it is.
      if (!enabled(settings)) return c.text('Not found', 404)
      const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
      const body = build({ posts, pages, settings, site: resolveSiteUrl(settings) })
      return new Response(body, { headers: { 'content-type': type } })
    })
  }

  feedRoute('/feed.xml', (s) => s.seo.rss, 'application/rss+xml; charset=utf-8',
    ({ posts, settings, site }) => renderFeed(posts, settings, site))
  feedRoute('/sitemap.xml', (s) => s.seo.sitemap, 'application/xml; charset=utf-8',
    ({ posts, pages, site }) => renderSitemap(posts, pages, site))
  feedRoute('/robots.txt', (s) => s.seo.robots, 'text/plain; charset=utf-8',
    ({ settings, site }) => renderRobots(settings, site))
  feedRoute('/llms.txt', (s) => s.seo.llms, 'text/plain; charset=utf-8',
    ({ posts, pages, settings, site }) => renderLlms(posts, pages, settings, site))

  // ----- the catch-all: one /{slug} namespace for posts AND pages -------------

  app.get('/:slug', async (c) => {
    const slug = c.req.param('slug')
    return cached(`/${slug}`, () => renderArticle(slug))()
  })

  return app
}
