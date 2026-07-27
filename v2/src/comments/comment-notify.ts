// Email the parent commenter when someone replies to their comment. Best-effort +
// transactional (they took part in the thread); never throws, degrades when SMTP is
// unconfigured. Called from the comment POST route on a reply.

import { getSmtpConfig, isMailConfigured, sendMail } from '@/news/mail'
import { getSettings } from '@/content/settings'
import { emailBrand } from '@/news/email-brand'
import { replyEmail } from '@/news/newsletter-email'
import { t } from '@/i18n/i18n'
import { one } from '@/store/query'

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
    const p = one<{ author_email: string | null; deleted_at: number | null }>(
      `select author_email, deleted_at from comments where id = ?`, opts.parentId,
    )
    const email = p?.author_email?.trim()
    if (!email || p?.deleted_at) return
    if (email.toLowerCase() === opts.replierEmail.trim().toLowerCase()) return // don't self-notify
    const postRow = one<{ title: string }>(`select title from posts where slug = ?`, opts.postSlug)
    const postTitle = postRow?.title ?? opts.postSlug
    const settings = await getSettings()
    const { subject, html } = replyEmail(
      t(settings.language),
      emailBrand(settings),
      opts.postSlug,
      postTitle,
      opts.replierName,
      opts.contentHtml,
    )
    await sendMail({ to: email, subject, html, kind: 'reply' })
  } catch (e) {
    console.error(`[ERROR] notifyReply: ${(e as Error).message}`)
  }
}
