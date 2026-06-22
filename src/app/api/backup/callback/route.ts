// GET /api/backup/callback -> Google Drive consent redirect lands here. Verifies the
// CSRF state, exchanges the code for a refresh token, stores it server-side, then
// bounces back to Settings → Advanced. Owner-only (middleware + requireOwner).

import type { NextRequest } from 'next/server'
import { exchangeCode, verifyState } from '@/lib/gdrive'
import { setDriveAuth } from '@/lib/backup-state'
import { logActivity } from '@/lib/activity'
import { logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'

// Bounce back to the Advanced settings tab with a result flag for a toast.
function back(origin: string, result: 'connected' | 'error'): Response {
  return Response.redirect(`${origin}/admin/settings?tab=advanced&backup=${result}`, 302)
}

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  const origin = req.nextUrl.origin
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return back(origin, 'error')
    }
    const params = req.nextUrl.searchParams
    const code = params.get('code')
    const state = params.get('state')
    if (params.get('error') || !code || !state || !verifyState(state)) {
      logRequest(req, 400, start)
      return back(origin, 'error')
    }
    const refreshToken = await exchangeCode(code, `${origin}/api/backup/callback`)
    await setDriveAuth(refreshToken)
    await logActivity('backup.connect', 'Google Drive')
    logRequest(req, 302, start)
    return back(origin, 'connected')
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return back(origin, 'error')
  }
}
