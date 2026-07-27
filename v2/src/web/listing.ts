// Everything that renders a LIST of posts: the home page, its pagination, category and
// tag pages, series pages and search results.
//
// One renderer for all of them. The frozen tree had a component per surface and the
// differences between them turned out to be the heading and the empty-state line, which is
// the kind of duplication that drifts: a card gains a field on the home page and quietly
// lacks it under a tag.

import type { Post } from '@/types'
import type { SiteSettings } from '@/types'
import { formatDate, t } from '@/i18n/i18n'
import { termSlug } from '@/content/taxonomy'
import type { Paged } from '@/content/paginate'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

/**
 * One card. Metadata only: a listing never loads a body.
 *
 * The ORDER is load-bearing and was wrong: the meta line sits ABOVE the title, not below.
 * That is the frozen tree's `PostCard` and it is what the owner reads first — the date and
 * the reading time frame the headline rather than trailing it.
 *
 * `showCategory` is off for the main feed, matching the frozen tree: the categories are
 * already in the sidebar, and repeating them under every headline was noise I added.
 */
function card(post: Post, settings: SiteSettings, opts: { showCategory?: boolean; lead?: boolean } = {}): string {
  const tx = t(settings.language)
  const category = opts.showCategory ? post.categories[0] : undefined
  const categoryLink = category
    ? `<a href="/category/${escapeAttr(termSlug(category))}">${escapeHtml(category)}</a> · `
    : ''
  // The suffix comes from the locale table. It read a hardcoded " min" here, so a
  // Vietnamese blog said "38 min" where every other surface said "38 phút đọc".
  const minutes = post.readingMinutes
    ? ` · ${post.readingMinutes} ${escapeHtml(tx.readingSuffix)}`
    : ''
  const Title = opts.lead ? 'h1' : 'h2'
  const size = opts.lead ? 'fs-h1' : 'fs-h2'

  // `reveal` eases the card in as it scrolls into view, and is fully visible when motion
  // is off or unsupported (pure CSS, `animation-timeline: view()`).
  return `<article class="reveal">
<p class="t-small text-meta">${categoryLink}<time datetime="${escapeAttr(post.date)}">${escapeHtml(formatDate(post.date, settings.language))}</time>${minutes}</p>
<${Title} class="reading-font mt-2 ${size} font-semibold"><a class="link-accent" href="/${escapeAttr(post.slug)}">${escapeHtml(post.title)}</a></${Title}>
${post.excerpt ? `<p class="reading-font mt-3 t-body text-text">${escapeHtml(post.excerpt)}</p>` : ''}
</article>`
}

/**
 * Prev/next links only. The frozen tree rendered numbered pages; deep page numbers are
 * navigation nobody uses and every one of them is a URL a crawler will walk, so this is a
 * deliberate simplification rather than an omission. Recorded in the ledger.
 */
function pager(paged: Paged<Post>, basePath: string): string {
  if (paged.totalPages <= 1) return ''
  const href = (n: number) => (n === 1 ? basePath || '/' : `${basePath}/page/${n}`)
  const prev = paged.page > 1
    ? `<a rel="prev" href="${escapeAttr(href(paged.page - 1))}">Newer</a>`
    : '<span></span>'
  const next = paged.page < paged.totalPages
    ? `<a rel="next" href="${escapeAttr(href(paged.page + 1))}">Older</a>`
    : '<span></span>'
  return `<nav class="pager">${prev}<span class="pager-count">${paged.page} / ${paged.totalPages}</span>${next}</nav>`
}

export type ListingView = {
  /** Shown above the list. Absent on the home page, where the site header already says it. */
  heading?: string
  /** A line under the heading: the term description, the series blurb, the result count. */
  subheading?: string
  paged: Paged<Post>
  /** Base for pagination links: '' for home, '/category/x' for a term. */
  basePath: string
  /** What to say when there is nothing. */
  empty: string
}

export function renderListing(view: ListingView, settings: SiteSettings): string {
  const head = view.heading
    ? `<header class="listing-head"><h1>${escapeHtml(view.heading)}</h1>${
        view.subheading ? `<p class="meta">${escapeHtml(view.subheading)}</p>` : ''
      }</header>`
    : ''
  const body = view.paged.items.length === 0
    ? `<p class="empty">${escapeHtml(view.empty)}</p>`
    : view.paged.items.map((p) => card(p, settings)).join('\n')
  return `${head}<div class="post-list">${body}</div>${pager(view.paged, view.basePath)}`
}
