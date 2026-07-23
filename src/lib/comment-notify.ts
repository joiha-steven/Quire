// Email the parent commenter when someone replies to their comment. Best-effort +
// transactional (they took part in the thread); never throws, degrades when SMTP is
// unconfigured. Called via `after()` from the comment POST route on a reply.

import { db } from '@/lib/db'
import { getSmtpConfig, isMailConfigured, sendMail } from '@/lib/mail'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { replyEmail } from '@/lib/newsletter-email'
import { t } from '@/lib/i18n'

export async function notifyReply(opts: {
  parentId: number
  postSlug: string
  replierName: string
  replierEmail: string
  contentHtml: string
}): Promise<void> {
  try {
    const cfg = await getSmtpConfig()
    if (!isMailConfigured(cfg)) return
    const { data: parent } = await db()
      .from('comments')
      .select('author_email,deleted_at')
      .eq('id', opts.parentId)
      .maybeSingle()
    const p = parent as { author_email: string | null; deleted_at: string | null } | null
    const email = p?.author_email?.trim()
    if (!email || p?.deleted_at) return
    if (email.toLowerCase() === opts.replierEmail.trim().toLowerCase()) return // don't self-notify
    const { data: postRow } = await db().from('posts').select('title').eq('slug', opts.postSlug).maybeSingle()
    const postTitle = (postRow as { title: string } | null)?.title ?? opts.postSlug
    const settings = await getSettings()
    const base = resolveSiteUrl(settings)
    const { subject, html } = replyEmail(
      t(settings.language),
      settings.title,
      base,
      opts.postSlug,
      postTitle,
      opts.replierName,
      opts.contentHtml,
    )
    await sendMail({ to: email, subject, html })
  } catch (e) {
    console.error(`[ERROR] notifyReply: ${(e as Error).message}`)
  }
}
