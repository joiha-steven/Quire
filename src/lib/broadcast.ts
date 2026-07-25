// Manual newsletter broadcast: email ONE chosen post to the confirmed subscribers,
// triggered by the owner from Admin → Newsletter. There is no automatic send — a
// scheduled post goes live on time but never mails anyone by itself (owner's call:
// every send is previewed and pressed by hand).
//
// Double-send guard: `posts.broadcast_at` is stamped on every send, and the caller
// must pass `force` to send a post that already has successful sends in the log. The
// LOG is the source of truth for "already sent", not the stamp — older posts carry a
// backfilled stamp from the old auto-broadcast era with no matching log rows.
// SERVER-ONLY.

import { db, liveOnly } from '@/lib/db'
import { getConfirmedSubscribers } from '@/lib/subscribers'
import { getSmtpConfig, isMailConfigured, sendMail } from '@/lib/mail'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { broadcastEmail } from '@/lib/newsletter-email'
import { newOpenToken, statsByPost } from '@/lib/newsletter-log'
import { isPublicallyVisible } from '@/lib/utils'
import { t } from '@/lib/i18n'

export type BroadcastPost = { slug: string; title: string; excerpt: string | null; broadcastAt?: string }

export class BroadcastError extends Error {}

// Read one publicly-visible post (only a live post can be mailed — the email links to it).
async function readSendablePost(slug: string): Promise<BroadcastPost & { status: string; date: string }> {
  const { data, error } = await liveOnly(
    db().from('posts').select('slug,title,excerpt,status,date,broadcast_at').eq('slug', slug),
  ).maybeSingle()
  if (error) throw new Error(`readSendablePost: ${error.message}`)
  const row = data as (BroadcastPost & { status: string; date: string; broadcast_at: string | null }) | null
  if (!row) throw new BroadcastError('post_not_found')
  if (!isPublicallyVisible(row.status, row.date)) throw new BroadcastError('post_not_public')
  return { ...row, broadcastAt: row.broadcast_at ?? undefined }
}

// Subject + HTML exactly as a subscriber would receive it, minus the tracking pixel and
// with a placeholder unsubscribe token — for the admin preview pane.
export async function previewBroadcast(slug: string): Promise<{ subject: string; html: string; post: BroadcastPost }> {
  const post = await readSendablePost(slug)
  const settings = await getSettings()
  const base = resolveSiteUrl(settings)
  const { subject, html } = broadcastEmail(t(settings.language), settings.title, base, post, 'preview-token')
  return { subject, html, post }
}

// Send `slug` to every confirmed subscriber. One email each, each logged (kind
// 'broadcast') with its own open token. Returns what actually happened.
export async function broadcastPost(
  slug: string,
  opts: { force?: boolean } = {},
): Promise<{ sent: number; failed: number; recipients: number }> {
  const post = await readSendablePost(slug)
  if (!opts.force) {
    const prior = (await statsByPost()).get(slug)
    if (prior && prior.sent > 0) throw new BroadcastError('already_sent')
  }
  const cfg = await getSmtpConfig()
  if (!isMailConfigured(cfg)) throw new BroadcastError('smtp_not_configured')

  const subs = await getConfirmedSubscribers()
  const settings = await getSettings()
  const base = resolveSiteUrl(settings)
  const tx = t(settings.language)

  let sent = 0
  let failed = 0
  for (const s of subs) {
    const openToken = newOpenToken()
    const { subject, html } = broadcastEmail(tx, settings.title, base, post, s.token, openToken)
    const res = await sendMail({ to: s.email, subject, html, kind: 'broadcast', postSlug: slug, openToken })
    if (res.sent) sent++
    else failed++
  }
  // Stamp even when nobody was reachable: it records that this post has been through
  // the send flow, and keeps the column meaningful for anything still reading it.
  await db().from('posts').update({ broadcast_at: new Date().toISOString() }).eq('slug', slug)
  return { sent, failed, recipients: subs.length }
}
