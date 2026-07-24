// Unsubscribe link from the broadcast footer (public). GET shows a confirm page; the
// actual unsubscribe runs on POST — email link scanners / prefetchers only issue GETs,
// so this stops a reader being silently unsubscribed without a click. (A List-Unsubscribe
// one-click POST from the mail client lands directly on the POST handler.) Idempotent.

import type { NextRequest } from 'next/server'
import { unsubscribeByToken } from '@/lib/subscribers'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { confirmPage, resultPage } from '@/lib/newsletter-html'
import { logRequest, logError } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    const token = req.nextUrl.searchParams.get('token') ?? ''
    const settings = await getSettings()
    const tx = t(settings.language)
    logRequest(req, 200, start)
    // No mutation on GET — just ask for a click that POSTs.
    return confirmPage(
      tx.nlUnsubFooter,
      tx.nlUnsubConfirm,
      tx.nlUnsubConfirmBtn,
      `/api/newsletter/unsubscribe?token=${encodeURIComponent(token)}`,
    )
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return new Response('Error', { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    const token = req.nextUrl.searchParams.get('token') ?? ''
    await unsubscribeByToken(token) // idempotent — same page whether or not it changed
    const settings = await getSettings()
    const tx = t(settings.language)
    const base = resolveSiteUrl(settings)
    logRequest(req, 200, start)
    return resultPage(tx.nlUnsubTitle, tx.nlUnsubBody, base, settings.title)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return new Response('Error', { status: 500 })
  }
}
