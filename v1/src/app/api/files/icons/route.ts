// GET /api/files/icons -> the site icons (favicon, app icon) uploaded in Settings
// (owner only). They live under files/ on Blob but aren't `files` rows, so the
// Files tab lists them separately (read-only, tagged "Settings").

import type { NextRequest } from 'next/server'
import { getSiteIcons } from '@/lib/files'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const icons = await getSiteIcons()
    logRequest(req, 200, start)
    return ok(icons)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to load icons', 500)
  }
}
