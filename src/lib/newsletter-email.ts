// Pure builders for the newsletter emails (broadcast a new post; notify a comment
// reply). Kept separate from the send path so they're unit-testable and shared. All
// interpolated values are escaped; the reply's `contentHtml` is the already-sanitized
// comment markdown (bold/italic only, escaped at source).

import type { Dict } from '@/locales/types'
import { escapeHtml } from '@/lib/utils'

const button = (href: string, label: string) =>
  `<p><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`

export function broadcastEmail(
  tx: Dict,
  siteTitle: string,
  base: string,
  post: { slug: string; title: string; excerpt?: string | null },
  unsubToken: string,
): { subject: string; html: string } {
  const url = `${base}/${post.slug}`
  const unsub = `${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}`
  const excerpt = post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ''
  const html =
    `<h2>${escapeHtml(post.title)}</h2>${excerpt}${button(url, tx.bcastRead)}` +
    `<hr><p style="color:#888;font-size:12px"><a href="${escapeHtml(unsub)}">${escapeHtml(tx.nlUnsubFooter)}</a></p>`
  return { subject: `${post.title} — ${siteTitle}`, html }
}

export function replyEmail(
  tx: Dict,
  siteTitle: string,
  base: string,
  postSlug: string,
  postTitle: string,
  replierName: string,
  contentHtml: string,
): { subject: string; html: string } {
  const url = `${base}/${postSlug}#comments`
  const intro = tx.replyIntro.replace('{name}', escapeHtml(replierName)).replace('{title}', escapeHtml(postTitle))
  const html = `<p>${intro}</p><blockquote>${contentHtml}</blockquote>${button(url, tx.replyRead)}`
  return { subject: `${tx.replySubject} — ${siteTitle}`, html }
}
