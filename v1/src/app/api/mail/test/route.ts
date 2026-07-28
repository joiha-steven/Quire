// POST /api/mail/test — send ONE sample email to the owner so the SMTP setup can be
// verified without waiting for a real sign-up or a real publish. Three kinds:
//   smtp      — a bare "it works" message (proves host/port/auth/From)
//   post      — the new-post broadcast, built from the newest published post
//   subscribe — the double opt-in confirmation a reader gets on sign-up
// Reuses the SAME builders as the real send paths, so what you test is what ships.
// Owner only; nothing is stored and no subscriber is touched.

import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { sendMail } from '@/lib/mail'
import { confirmEmail, broadcastEmail } from '@/lib/newsletter-email'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { emailBrand } from '@/lib/email-brand'
import { getPublicPosts } from '@/lib/posts'
import { getAuthState } from '@/lib/auth'
import { logActivity } from '@/lib/activity'
import { t } from '@/lib/i18n'
import { escapeHtml } from '@/lib/utils'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

const KINDS = ['smtp', 'post', 'subscribe'] as const
type Kind = (typeof KINDS)[number]

// Placeholder token for the confirm / unsubscribe links: a test send must never mint
// a real one, so the link is deliberately dead (it renders the "invalid link" page).
const FAKE_TOKEN = 'test-token'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { kind?: unknown; to?: unknown }
    const kind = KINDS.find((k) => k === body.kind) as Kind | undefined
    if (!kind) {
      logRequest(req, 400, start)
      return fail('invalid_kind', 400)
    }
    // Default recipient = the signed-in owner; the form may override it to check
    // deliverability against another provider.
    const { email: owner } = await getAuthState()
    const to = (typeof body.to === 'string' ? body.to.trim() : '') || owner || ''
    if (!to) {
      logRequest(req, 400, start)
      return fail('no_recipient', 400)
    }

    const settings = await getSettings()
    const tx = t(settings.language)
    const base = resolveSiteUrl(settings)
    // The owner's own logo + palette, so a test looks exactly like the real thing.
    const brand = emailBrand(settings)
    let mail: { subject: string; html: string }
    if (kind === 'smtp') {
      mail = {
        subject: `${tx.mailTestSubject} — ${settings.title}`,
        html: `<p>${escapeHtml(tx.mailTestBody)}</p>`,
      }
    } else if (kind === 'subscribe') {
      mail = confirmEmail(tx, brand, `${base}/api/newsletter/confirm?token=${FAKE_TOKEN}`)
    } else {
      // Newest published post = exactly what the next broadcast would carry; on an
      // empty blog fall back to a stand-in so the layout is still previewable.
      const [latest] = await getPublicPosts()
      const post = latest ?? { slug: '', title: tx.mailTestSamplePost, excerpt: null }
      mail = broadcastEmail(tx, brand, [post], FAKE_TOKEN)
    }

    const { sent, error } = await sendMail({ to, ...mail, kind: 'test' })
    if (!sent) {
      logRequest(req, 502, start)
      return fail(error || 'send_failed', 502)
    }
    after(() => logActivity('mail.test', kind))
    logRequest(req, 200, start)
    return ok({ to })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to send test email', 500)
  }
}
