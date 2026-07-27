// The public router.
//
// Hono, not a framework: a route is a function from a request to a string, and the whole
// page cache is one Map (Invariant 1). What was ISR plus a tagged data cache plus a
// per-write path superset is now "render it, keep the string, throw all of them away on
// any write".
//
// M2 IN PROGRESS. The article route is here; listings, taxonomy, feeds and the islands
// land in later slices. Nothing below serves a partial page: a route either exists and is
// complete, or it 404s.

import { Hono } from 'hono'
import { getPost } from '@/content/posts'
import { getPage } from '@/content/pages'
import { getMediaRefs } from '@/media/media-refs'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { collapseBlob } from '@/media/blob'
import { renderPostContent, type ImageDims } from '@/render/post-content'
import { formatDate } from '@/i18n/i18n'
import { isPublicallyVisible, clampExcerpt, toPlainText } from '@/utils'
import { pageCache } from '@/server/cache'
import { renderDocument, pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * Media facts the renderer needs: which originals have responsive variants, and the
 * intrinsic size of each. Read once per render rather than per image.
 */
async function mediaFacts(): Promise<{ ready: Set<string>; dims: ImageDims }> {
  const refs = await getMediaRefs()
  const ready = new Set<string>()
  const dims: ImageDims = new Map()
  for (const r of refs) {
    const key = collapseBlob(r.url)
    if (r.variants) ready.add(key)
    if (r.width && r.height) dims.set(key, { width: r.width, height: r.height })
  }
  return { ready, dims }
}

async function renderArticle(slug: string): Promise<string | null> {
  const settings = await getSettings()
  const post = await getPost(slug)
  const page = post ? null : await getPage(slug)

  // Posts and pages share one /{slug} namespace (Invariant 2), so at most one matches.
  // A draft or a future-dated post is not public: same rule as the frozen tree, and the
  // reason `/preview/{slug}` exists separately.
  if (post && !isPublicallyVisible(post.status, post.date)) return null
  if (page && page.status !== 'published') return null
  const item = post ?? page
  if (!item) return null

  const { ready, dims } = await mediaFacts()
  const body = await renderPostContent({
    markdown: item.content, readyOriginals: ready, imageDims: dims,
  })

  const meta = post
    ? `<p class="meta"><time datetime="${escapeHtml(post.date)}">${escapeHtml(formatDate(post.date, settings.language))}</time>`
      + (post.readingMinutes ? ` · ${post.readingMinutes} min` : '')
      + '</p>'
    : ''

  const description = post?.metaDescription
    || post?.excerpt
    || clampExcerpt(toPlainText(item.content).slice(0, 300))

  const site = resolveSiteUrl(settings)
  return renderDocument(
    settings,
    {
      title: `${post?.metaTitle || item.title} · ${settings.title}`,
      description,
      canonical: site ? `${site}/${item.slug}` : undefined,
    },
    pageStyles(settings, PUBLIC_CSS),
    `<div class="wrap">
<header class="site"><a class="title" href="/">${escapeHtml(settings.title)}</a></header>
<article>
<h1>${escapeHtml(item.title)}</h1>
${meta}
<div class="prose">${body}</div>
</article>
</div>`,
  )
}

export function createApp(): Hono {
  const app = new Hono()

  app.get('/:slug', async (c) => {
    const slug = c.req.param('slug')
    const key = `/${slug}`

    const hit = pageCache.get(key)
    if (hit !== undefined) return c.html(hit)

    const html = await renderArticle(slug)
    if (html === null) return c.text('Not found', 404)

    pageCache.set(key, html)
    return c.html(html)
  })

  return app
}
