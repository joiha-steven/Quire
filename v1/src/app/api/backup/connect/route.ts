// GET /api/backup/connect -> redirect the owner to Google's Drive consent screen.
// One-time flow, separate from sign-in: scope `drive.file` + offline so backups get
// a refresh token without touching the login scope. The callback stores the token.

import type { NextRequest } from 'next/server'
import { consentUrl, signState, backupRedirectUri } from '@/lib/gdrive'
import { getSettings } from '@/lib/settings'
import { fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    // Deterministic redirect from the canonical site URL (NOT the request origin),
    // so it always matches the one URI registered on the OAuth client even when the
    // admin is reached via a proxy/CDN host.
    const redirectUri = backupRedirectUri(await getSettings())
    const url = consentUrl(redirectUri, signState())
    logRequest(req, 302, start)
    return Response.redirect(url, 302)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Could not start Google Drive connect', 500)
  }
}
