// GET /api/backup/connect -> redirect the owner to Google's Drive consent screen.
// One-time flow, separate from sign-in: scope `drive.file` + offline so backups get
// a refresh token without touching the login scope. The callback stores the token.

import type { NextRequest } from 'next/server'
import { consentUrl, signState } from '@/lib/gdrive'
import { fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const redirectUri = `${req.nextUrl.origin}/api/backup/callback`
    const url = consentUrl(redirectUri, signState())
    logRequest(req, 302, start)
    return Response.redirect(url, 302)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Could not start Google Drive connect', 500)
  }
}
