// The article page: a post or a static page at /{slug}.
//
// Split out of the router so the router stays a routing table. Returns null when the slug
// is not publicly readable, and the caller turns that into a 404 — a renderer that decides
// status codes is a renderer that eventually returns a 200 with an apology on it.

import { getPost } from '@/content/posts'
import { getPage } from '@/content/pages'
import { getMediaRefs } from '@/media/media-refs'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { getSeriesForPost } from '@/content/series'
import { collapseBlob } from '@/media/blob'
import { renderPostContent, type ImageDims } from '@/render/post-content'
import { termSlug } from '@/content/taxonomy'
import { formatDate, t } from '@/i18n/i18n'
import { scriptTag } from '@/web/assets'
import { ogImageUrl } from '@/render/og'
import { isPublicallyVisible, clampExcerpt, toPlainText } from '@/utils'
import { renderDocument, pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

/**
 * Media facts the renderer needs: which originals have responsive variants, and the
 * intrinsic size of each. Read once per render rather than per image.
 */
async function mediaFacts(): Promise<{ ready: Set<string>; dims: ImageDims }> {
  const ready = new Set<string>()
  const dims: ImageDims = new Map()
  for (const r of await getMediaRefs()) {
    const key = collapseBlob(r.url)
    if (r.variants) ready.add(key)
    if (r.width && r.height) dims.set(key, { width: r.width, height: r.height })
  }
  return { ready, dims }
}

/** Comma-separated term links, as the frozen tree rendered them. */
function terms(list: string[], kind: 'category' | 'tag'): string {
  return list
    .map((x) => `<a href="/${kind}/${escapeAttr(termSlug(x))}">${escapeHtml(x)}</a>`)
    .join(', ')
}

export async function renderArticle(slug: string): Promise<string | null> {
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

  let meta = ''
  let footer = ''
  if (post) {
    const bits = [
      `<time datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date, settings.language))}</time>`,
      post.readingMinutes ? `${post.readingMinutes} min` : '',
      terms(post.categories, 'category'),
    ].filter(Boolean)
    meta = `<p class="meta">${bits.join(' · ')}</p>`

    const series = await getSeriesForPost(post.slug)
    const seriesBox = series
      ? `<nav class="series"><p class="meta">${escapeHtml(series.name)}</p><ol>${
          series.posts.map((p, i) => (p.slug === post.slug
            ? `<li aria-current="true">${escapeHtml(p.title)}</li>`
            : `<li><a href="/${escapeAttr(p.slug)}">${escapeHtml(p.title)}</a></li>`)
            + (i === series.currentIndex ? '' : '')).join('')
        }</ol></nav>`
      : ''
    const tagLine = post.tags.length
      ? `<p class="tags">${terms(post.tags, 'tag')}</p>`
      : ''
    footer = seriesBox + tagLine
  }

  const description = post?.metaDescription
    || post?.excerpt
    || clampExcerpt(toPlainText(item.content).slice(0, 300))

  // The reading-progress bar is markup plus a scroll-driven CSS animation, with no script
  // behind it: it therefore works with JavaScript switched off, and costs nothing on the
  // main thread. `@supports` in the sheet hides it on an engine without scroll timelines,
  // so the failure mode is absence rather than a bar stuck at zero.
  const progress = settings.features.progressBar
    ? '<div class="progress" aria-hidden="true"><div class="progress-fill"></div></div>'
    : ''

  // The one bundle a reader loads, and the strings it will show them. Each island inside
  // it checks for its own markup first, so a post with no code blocks and no images runs
  // two cheap queries that find nothing rather than downloading two different files.
  const s = t(settings.language)
  const shell = {
    bodyData: {
      copyCode: s.copyCode,
      copiedCode: s.copiedCode,
      backToTop: s.backToTop,
      lightboxPrev: s.lightboxPrev,
      lightboxNext: s.lightboxNext,
      lightboxClose: s.lightboxClose,
    },
    scripts: scriptTag('core') + scriptTag('post'),
  }

  const site = resolveSiteUrl(settings)
  return renderDocument(
    settings,
    {
      title: `${post?.metaTitle || item.title} · ${settings.title}`,
      description,
      canonical: site ? `${site}/${item.slug}` : undefined,
      // Absolute, always: `resolveSiteUrl` falls back to SITE_URL and then to localhost,
      // and a relative og:image is ignored by every scraper.
      image: ogImageUrl(settings, site, {
        title: post?.metaTitle || item.title,
        featuredImage: post?.featuredImage,
        desc: post ? description : undefined,
        date: post ? formatDate(post.date, settings.language) : undefined,
      }),
      ogType: post ? 'article' : 'website',
    },
    pageStyles(settings, PUBLIC_CSS),
    `${progress}<div class="wrap">
<header class="site"><a class="title" href="/">${escapeHtml(settings.title)}</a></header>
<article>
<h1>${escapeHtml(item.title)}</h1>
${meta}
<div class="prose">${body}</div>
${footer}
</article>
</div>`,
    shell,
  )
}
