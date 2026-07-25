// Pure builders for the newsletter emails (confirm a sign-up; broadcast a new post;
// notify a comment reply). Kept separate from the send path so they're unit-testable
// and shared between the real send and the admin test send. All
// interpolated values are escaped; the reply's `contentHtml` is the already-sanitized
// comment markdown (bold/italic only, escaped at source).

import type { Dict } from '@/locales/types'
import { escapeHtml } from '@/lib/utils'

const button = (href: string, label: string) =>
  `<p><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></p>`

// Double opt-in email: the link that flips a pending subscriber to confirmed.
export function confirmEmail(tx: Dict, siteTitle: string, confirmUrl: string): { subject: string; html: string } {
  const html =
    `<p>${tx.nlConfirmIntro.replace('{site}', escapeHtml(siteTitle))}</p>` +
    button(confirmUrl, tx.nlConfirmButton) +
    `<p style="color:#888;font-size:13px">${tx.nlConfirmIgnore}</p>`
  return { subject: `${tx.nlConfirmSubject} — ${siteTitle}`, html }
}

// `openToken` (optional) appends the 1x1 open-tracking pixel. Omitted for the preview
// and the test send, so neither pollutes the open rate.
export function broadcastEmail(
  tx: Dict,
  siteTitle: string,
  base: string,
  post: { slug: string; title: string; excerpt?: string | null },
  unsubToken: string,
  openToken?: string,
): { subject: string; html: string } {
  const url = `${base}/${post.slug}`
  const unsub = `${base}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken)}`
  const excerpt = post.excerpt ? `<p>${escapeHtml(post.excerpt)}</p>` : ''
  const pixel = openToken
    ? `<img src="${escapeHtml(`${base}/api/newsletter/open?t=${encodeURIComponent(openToken)}`)}" width="1" height="1" alt="" style="display:block;border:0">`
    : ''
  const html =
    `<h2>${escapeHtml(post.title)}</h2>${excerpt}${button(url, tx.bcastRead)}` +
    `<hr><p style="color:#888;font-size:12px"><a href="${escapeHtml(unsub)}">${escapeHtml(tx.nlUnsubFooter)}</a></p>${pixel}`
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
