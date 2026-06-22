// GET /api/media/unused -> URLs of media referenced nowhere (owner only).
// Read-only audit: it reports, it never deletes. The owner removes any item by
// hand from the library, so there is no cache to purge here.

import type { NextRequest } from 'next/server'
import { findUnusedMedia } from '@/lib/media-usage'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Admin-only live audit: db() GET reads are Data-Cache-eligible (tag 'db', 1h). force-dynamic
// alone does NOT de-cache them (they set an explicit next.revalidate) — `fetchCache =
// 'force-no-store'` forces a live read so the "unused" set reflects the current DB.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Reads every post/page body plus revision snapshots to collect references.
export const maxDuration = 60

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const urls = await findUnusedMedia()
    logRequest(req, 200, start)
    return ok(urls)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to audit media', 500)
  }
}
