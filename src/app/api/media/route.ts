// GET /api/media -> media manifest (owner only; the admin media library reads it).

import type { NextRequest } from 'next/server'
import { getMedia } from '@/lib/media'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Admin-only live data: db() GET reads are Data-Cache-eligible (tag 'db', 1h). force-dynamic
// alone does NOT de-cache them (they set an explicit next.revalidate) — `fetchCache =
// 'force-no-store'` forces a live read so the library stays current after an upload/delete.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    // Owner only: only the admin media library consumes this (same-origin, cookied).
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const items = await getMedia()
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read media', 500)
  }
}
