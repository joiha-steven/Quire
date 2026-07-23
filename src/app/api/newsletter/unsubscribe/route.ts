// GET /api/newsletter/unsubscribe?token= — one-click unsubscribe link (public), sent
// in the footer of every broadcast. Idempotent; always shows a friendly result page.

import type { NextRequest } from 'next/server'
import { unsubscribeByToken } from '@/lib/subscribers'
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
