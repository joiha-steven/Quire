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
import { t } from '@/i18n/i18n'
import { foldAccents } from '@/utils'
import { renderListing } from '@/web/listing'
import { cached, listingPage, renderFeedBody } from '@/web/listing-page'
import { renderFeed, renderLlms, renderRobots, renderSitemap } from '@/web/feeds'
import { renderArticle } from '@/web/article'
import { assetBody } from '@/web/assets'
import { handleOg } from '@/web/og'
import { handleTrack } from '@/web/track'
import { handleUpload } from '@/web/uploads'
import { handleMarkdown, wantsMarkdown } from '@/web/markdown'
import { handleManifest } from '@/web/manifest'
import { handlePreview } from '@/web/preview'
import { handleSearch } from '@/web/search-api'
import { errorHandler, requestLogger } from '@/web/api'
import { contentRoutes } from '@/web/admin/content'
import { siteRoutes } from '@/web/admin/site'
import { uploadRoutes } from '@/web/admin/uploads'
import { newsRoutes } from '@/web/admin/news'
import { opsRoutes, publicOpsRoutes } from '@/web/admin/ops'
import { mcpAdminRoutes, mcpOAuthRoutes } from '@/web/admin/mcp'
import { staticFile, staticPaths } from '@/web/static'
import { handleCommentsGet, handleCommentsPost } from '@/web/comments'
import {
  handleConfirm, handleOpenPixel, handleSubscribe, handleUnsubscribeGet, handleUnsubscribePost,
} from '@/web/newsletter'
import {
  handleEnrol, handleEnrolDone, handleLogin, handleLoginPage, handleLogout,
  handleTwoFactor, handleTwoFactorPage,
} from '@/web/auth-routes'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** A page number from the URL. Anything that is not a positive integer is a 404, not a 1. */
function pageNumber(raw: string): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 ? n : null
}

export function createApp(): Hono {
  const app = new Hono()

  // Every request is timed and logged here rather than at the end of each handler. A rule
  // kept by remembering it is a rule that a route eventually forgets.
  app.use('*', requestLogger())

  // ...and the same argument for errors: a handler may throw, and this is the one place
  // that becomes a logged, typed 500.
  app.onError(errorHandler())

  const home = async (page: number) => {
    const settings = await getSettings()
    const built = await renderFeedBody(await getPublicPosts(), page, {
      basePath: '', empty: t(settings.language).emptyPosts,
    })
    if (!built) return null
    return listingPage({
      title: page === 1 ? settings.title : `${settings.title} · page ${page}`,
      body: built.body,
      css: built.css,
      canonicalPath: page === 1 ? '/' : `/page/${page}`,
    })
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
      // "Danh muc: Kinh te" / "The: #edc" — the label, then the term, exactly as the
      // frozen tree reads. A tag lowercases its own name and wears a hash.
      const label = kind === 'category' ? t(settings.language).categoryLabel : t(settings.language).tagLabel
      const term = kind === 'category'
        ? escapeHtml(name)
        : `<span class="lower">#${escapeHtml(name)}</span>`
      const built = await renderFeedBody(posts, page, {
        heading: `${escapeHtml(label)}: ${term}`,
        basePath: `/${kind}/${slug}`,
        empty: kind === 'category' ? t(settings.language).emptyCategory : t(settings.language).emptyTag,
      })
      if (!built) return null
      return listingPage({
        title: `${name} · ${settings.title}`,
        body: built.body,
        css: built.css,
        canonicalPath: `/${kind}/${slug}`,
        cardTitle: name,
        // The archive's own URL is the row to mark in the rail.
        activeHref: `/${kind}/${slug}`,
      })
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
      // A series is read in order, front to back: it is not paginated, and it is never a
      // timeline — its order is the owner's, not the calendar's.
      return listingPage({
        title: `${name} · ${settings.title}`,
        body: renderListing({
          heading: `${escapeHtml(t(settings.language).seriesLabel)}: ${escapeHtml(name)}`,
          paged: { items: posts, page: 1, totalPages: 1 },
          basePath: `/series/${slug}`, empty: t(settings.language).emptySeries,
        }, settings),
        canonicalPath: `/series/${slug}`,
        cardTitle: name,
      })
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
      heading: escapeHtml(t(settings.language).search),
      subheading: q ? `${results.length} result${results.length === 1 ? '' : 's'} for "${q}"` : undefined,
      paged: { items: results, page: 1, totalPages: 1 },
      basePath: '/search',
      empty: q ? t(settings.language).searchEmpty : t(settings.language).searchHint,
    }, settings)
    const form = `<form class="search" action="/search" method="get" role="search">
<input type="search" name="q" value="${escapeHtml(q)}" aria-label="${escapeHtml(t(settings.language).search)}">
<button type="submit">${escapeHtml(t(settings.language).search)}</button>
</form>`
    return c.html(await listingPage({
      title: `${t(settings.language).search} · ${settings.title}`,
      body: form + body,
    }))
  })

  // ----- the analytics beacon -------------------------------------------------
  // Public and unauthenticated by necessity: it is called by every reader's browser. It
  // is rate-limited per IP, drops bots and admin paths, and stores no PII.

  app.post('/api/track', handleTrack)

  // ----- the JSON and machine surfaces ----------------------------------------

  app.get('/api/search', handleSearch)

  // The client-side search index: slug, title, date and accent-folded terms for every
  // public post. PUBLIC, and it carries nothing a reader could not read by browsing the
  // site — no drafts, no bodies. 404 when search is switched off, so a disabled feature
  // does not leave an endpoint quietly answering.
  app.get('/api/search/index', async (c) => {
    const { features } = await getSettings()
    if (!features.search) return c.json({ error: 'Search disabled' }, 404)
    const posts = await getPublicPosts()
    return c.json(posts.map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      terms: foldAccents([p.title, p.tags.join(' '), p.categories.join(' ')].join(' ')),
    })))
  })
  app.get('/api/comments', handleCommentsGet)
  app.post('/api/comments', handleCommentsPost)
  app.post('/api/subscribe', handleSubscribe)
  app.get('/api/newsletter/confirm', handleConfirm)
  // GET asks for a click, POST does it. Link scanners and mail-client prefetchers issue
  // GETs, so unsubscribing on GET means an appliance that merely looked at an inbox can
  // remove the reader from the list.
  app.get('/api/newsletter/unsubscribe', handleUnsubscribeGet)
  app.post('/api/newsletter/unsubscribe', handleUnsubscribePost)
  app.get('/api/newsletter/open', handleOpenPixel)
  app.get('/api/md/:slug', handleMarkdown)
  app.get('/manifest.webmanifest', handleManifest)

  // ----- sign-in --------------------------------------------------------------
  // The only write routes that cannot be owner-gated, because they are how one becomes an
  // owner. Each is listed in `scripts/checks/routes-guarded.ts` with the reason it is
  // public, so the exception is a decision on the record rather than an omission.

  app.get('/login', handleLoginPage)
  app.get('/login/2fa', handleTwoFactorPage)
  app.post('/api/auth/login', handleLogin)
  app.post('/api/auth/2fa', handleTwoFactor)
  app.post('/api/auth/enrol', handleEnrol)
  app.post('/api/auth/enrol/done', handleEnrolDone)
  app.post('/api/auth/logout', handleLogout)

  // ----- the admin API --------------------------------------------------------
  // Mounted at the root because each route already carries its full `/api/...` path, and
  // `route()` here would prefix them a second time. Every one of these is behind
  // `requireOwner()` by virtue of the router it was registered on, not by a check inside
  // it (Invariant 4), and `check:routes` fails the build if one escapes.

  app.route('/', contentRoutes().routes)
  app.route('/', siteRoutes().routes)
  app.route('/', uploadRoutes().routes)
  app.route('/', newsRoutes().routes)
  app.route('/', opsRoutes().routes)
  app.route('/', publicOpsRoutes())
  app.route('/', mcpAdminRoutes().routes)
  app.route('/', mcpOAuthRoutes())

  // ----- drafts ---------------------------------------------------------------
  // Registered before `/:slug` so a post that happens to be called "preview" cannot
  // shadow it, and kept off that route so the public page has no token branch at all.

  app.get('/preview/:slug', handlePreview)

  // ----- the Open Graph card --------------------------------------------------
  // Everything it needs is in the query string, so it reads no settings and no database.

  app.get('/og', handleOg)

  // ----- media ----------------------------------------------------------------
  // Every image and video in a rendered page resolves here. Streamed, range-capable, and
  // cached forever, because upload names are content-stable.

  app.get('/uploads/*', handleUpload)

  // Fonts, favicon and app icon. Registered path by path rather than under a prefix, so
  // this route can only ever serve files that are compiled in. The reading font is the LCP
  // resource on an article page, which is why the head preloads it.
  for (const path of staticPaths()) {
    app.get(path, async () => (await staticFile(path)) ?? new Response('Not found', { status: 404 }))
  }

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
    // An agent that asks for Markdown gets the source it was written in rather than HTML
    // it would have to parse back into prose. Same URL, same visibility rules.
    if (wantsMarkdown(c.req.header('accept'))) return handleMarkdown(c)
    return cached(`/${slug}`, () => renderArticle(slug))()
  })

  return app
}
