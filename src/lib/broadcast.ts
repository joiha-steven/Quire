// Broadcast-on-publish: email confirmed subscribers ONCE when a post first goes live.
// Run by the cron (same ticks as the scheduled-publish sweep). A post is "due" when it
// is published, its date has passed, it isn't trashed, and `broadcast_at` is still null.
// SERVER-ONLY.
//
// Safety: every due post is STAMPED after processing, even when SMTP is unconfigured or
// there are no confirmed subscribers — so turning the newsletter on later never bursts
// the back catalogue. The migration backfills already-live posts as sent.

import { db, liveOnly } from '@/lib/db'
import { getConfirmedSubscribers } from '@/lib/subscribers'
import { getSmtpConfig, isMailConfigured, sendMail } from '@/lib/mail'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { broadcastEmail } from '@/lib/newsletter-email'
import { t } from '@/lib/i18n'

type DuePost = { slug: string; title: string; excerpt: string | null }

export async function broadcastDuePosts(): Promise<{ posts: number; emails: number }> {
  const nowIso = new Date().toISOString()
  const { data, error } = await liveOnly(
    db()
      .from('posts')
      .select('slug,title,excerpt')
      .eq('status', 'published')
      .lte('date', nowIso),
  ).is('broadcast_at', null)
  if (error) throw new Error(`broadcastDuePosts: ${error.message}`)
  const due = (data ?? []) as DuePost[]
  if (due.length === 0) return { posts: 0, emails: 0 }

  const settings = await getSettings()
  const cfg = await getSmtpConfig()
  const subs = isMailConfigured(cfg) ? await getConfirmedSubscribers() : []
  const base = resolveSiteUrl(settings)
  const tx = t(settings.language)

  let emails = 0
  for (const post of due) {
    for (const s of subs) {
      const { subject, html } = broadcastEmail(tx, settings.title, base, post, s.token)
      const { sent } = await sendMail({ to: s.email, subject, html })
      if (sent) emails++
    }
    // Stamp regardless of send outcome — one-time; never re-broadcast.
    await db().from('posts').update({ broadcast_at: nowIso }).eq('slug', post.slug)
  }
  return { posts: due.length, emails }
}
