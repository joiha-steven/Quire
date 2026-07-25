// POST /api/subscribe — public newsletter sign-up (double opt-in). Creates a PENDING
// subscriber and emails a confirm link; the address only receives broadcasts after it
// clicks through. Public (in middleware's isPublicApi) + rate-limited.

import type { NextRequest } from 'next/server'
import { addSubscriber, SubscribeError } from '@/lib/subscribers'
import { sendMail } from '@/lib/mail'
import { confirmEmail } from '@/lib/newsletter-email'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { getDefaultTheme } from '@/lib/themes'
import { t } from '@/lib/i18n'
import { rateLimited, clientIp } from '@/lib/rate-limit'
import { ok, fail, logRequest, logError } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (rateLimited(`subscribe:${clientIp(req)}`, 5)) {
      logRequest(req, 429, start)
      return fail('Too many requests', 429)
    }
    const body = (await req.json().catch(() => ({}))) as { email?: unknown }
    const email = typeof body.email === 'string' ? body.email : ''
    let token: string
    let alreadyConfirmed: boolean
    try {
      ;({ token, alreadyConfirmed } = await addSubscriber(email))
    } catch (e) {
      if (e instanceof SubscribeError) {
        logRequest(req, 400, start)
        return fail('invalid_email', 400)
      }
      throw e
    }
    // Already on the list → nothing to send; report success (don't leak membership).
    if (alreadyConfirmed) {
      logRequest(req, 200, start)
      return ok({ status: 'already' })
    }
    const settings = await getSettings()
    const tx = t(settings.language)
    const base = resolveSiteUrl(settings)
    const confirmUrl = `${base}/api/newsletter/confirm?token=${encodeURIComponent(token)}`
    const theme = getDefaultTheme(settings.themes, settings.themePreset).light
    const { subject, html } = confirmEmail(tx, settings.title, confirmUrl, base, theme)
    // Best-effort: the row is already pending, so even if mail is unconfigured the
    // owner can see the pending sign-up. Report whether the email actually went out.
    const { sent } = await sendMail({ to: email.trim().toLowerCase(), subject, html, kind: 'confirm' })
    logRequest(req, 200, start)
    return ok({ status: sent ? 'sent' : 'pending_no_mail' })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to subscribe', 500)
  }
}
