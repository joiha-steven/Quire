// Manual newsletter broadcast: email one or more chosen posts to the confirmed
// subscribers, triggered by the owner from Admin → Newsletter. There is no automatic
// send — a scheduled post goes live on time but never mails anyone by itself (owner's
// call: every send is previewed and pressed by hand).
//
// Several posts = ONE digest email (newest leads, the rest follow), not one email per
// post — picking three posts should not put three messages in someone's inbox.
//
// Every subscriber gets their OWN message: the unsubscribe link and the open pixel are
// per-recipient, so a single BCC blast would break both.
//
// Double-send guard: `posts.broadcast_at` is stamped on every send, and the caller must
// pass `force` to send a post that already has successful sends in the log. The LOG is
// the source of truth for "already sent", not the stamp — older posts carry a backfilled
// stamp from the retired auto-broadcast with no matching log rows.
// SERVER-ONLY.

import { db, liveOnly } from '@/lib/db'
import { getConfirmedSubscribers } from '@/lib/subscribers'
import { getSmtpConfig, isMailConfigured, sendMail } from '@/lib/mail'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { getDefaultTheme } from '@/lib/themes'
import { broadcastEmail, type EmailPost } from '@/lib/newsletter-email'
import { newOpenToken, statsByPost } from '@/lib/newsletter-log'
import { expandBlob } from '@/lib/blob'
import { isPublicallyVisible } from '@/lib/utils'
import type { SiteLang } from '@/types'
import { t, formatDate } from '@/lib/i18n'

export class BroadcastError extends Error {}

type Row = { slug: string; title: string; excerpt: string | null; cover_image: string | null; status: string; date: string }

// Read the chosen posts, IN THE ORDER GIVEN (the admin lists newest-first, so the lead
// of a digest is whatever the owner ticked first). Only publicly-visible posts can be
// mailed — the email links straight to them.
async function readSendablePosts(slugs: string[], lang: SiteLang): Promise<EmailPost[]> {
  if (slugs.length === 0) throw new BroadcastError('no_posts')
  const { data, error } = await liveOnly(
    db().from('posts').select('slug,title,excerpt,cover_image,status,date').in('slug', slugs),
  )
  if (error) throw new Error(`readSendablePosts: ${error.message}`)
  const found = new Map((((data ?? []) as Row[])).map((r) => [r.slug, r]))
  return slugs.map((slug) => {
    const row = found.get(slug)
    if (!row) throw new BroadcastError('post_not_found')
    if (!isPublicallyVisible(row.status, row.date)) throw new BroadcastError('post_not_public')
    return {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      // Cover refs are stored store-relative (Invariant 3) — an email needs the real URL.
      coverImage: row.cover_image ? expandBlob(row.cover_image) : null,
      dateLabel: formatDate(row.date, lang),
    }
  })
}

// Subject + HTML exactly as a subscriber would receive it, minus the tracking pixel and
// with a placeholder unsubscribe token — for the admin preview pane.
export async function previewBroadcast(slugs: string[]): Promise<{ subject: string; html: string }> {
  const settings = await getSettings()
  const posts = await readSendablePosts(slugs, settings.language)
  const theme = getDefaultTheme(settings.themes, settings.themePreset).light
  const base = resolveSiteUrl(settings)
  return broadcastEmail(t(settings.language), settings.title, base, posts, 'preview-token', theme)
}

// Send the chosen posts as one email to every confirmed subscriber. Each send is logged
// (kind 'broadcast') with its own open token.
export async function broadcastPosts(
  slugs: string[],
  opts: { force?: boolean } = {},
): Promise<{ sent: number; failed: number; recipients: number }> {
  const settings = await getSettings()
  const posts = await readSendablePosts(slugs, settings.language)
  if (!opts.force) {
    const prior = await statsByPost()
    if (slugs.some((s) => (prior.get(s)?.sent ?? 0) > 0)) throw new BroadcastError('already_sent')
  }
  const cfg = await getSmtpConfig()
  if (!isMailConfigured(cfg)) throw new BroadcastError('smtp_not_configured')

  const subs = await getConfirmedSubscribers()
  const theme = getDefaultTheme(settings.themes, settings.themePreset).light
  const base = resolveSiteUrl(settings)
  const tx = t(settings.language)

  let sent = 0
  let failed = 0
  for (const s of subs) {
    const openToken = newOpenToken()
    const { subject, html } = broadcastEmail(tx, settings.title, base, posts, s.token, theme, openToken)
    const res = await sendMail({ to: s.email, subject, html, kind: 'broadcast', postSlugs: slugs, openToken })
    if (res.sent) sent++
    else failed++
  }
  // Stamp even when nobody was reachable: it records that these posts have been through
  // the send flow, and keeps the column meaningful for anything still reading it.
  await db().from('posts').update({ broadcast_at: new Date().toISOString() }).in('slug', slugs)
  return { sent, failed, recipients: subs.length }
}
