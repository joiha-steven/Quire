// GET /api/newsletter/confirm?token= — the double opt-in confirm link (public). Flips
// a pending subscriber to confirmed and shows a plain result page.

import type { NextRequest } from 'next/server'
import { confirmSubscriber } from '@/lib/subscribers'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { resultPage } from '@/lib/newsletter-html'
import { logRequest, logError } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    const token = req.nextUrl.searchParams.get('token') ?? ''
    const okc = await confirmSubscriber(token)
    const settings = await getSettings()
    const tx = t(settings.language)
    const base = resolveSiteUrl(settings)
    logRequest(req, 200, start)
    return okc
      ? resultPage(tx.nlThanksTitle, tx.nlThanksBody, base, settings.title)
      : resultPage(tx.nlLinkInvalid, '', base, settings.title)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return new Response('Error', { status: 500 })
  }
}
