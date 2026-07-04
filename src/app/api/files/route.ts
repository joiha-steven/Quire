// GET /api/files -> the file-library manifest (owner only).
// Uploads are POSTed to /api/files/attach, which writes them to the local store and
// registers them in one shot (a Node host has no 4.5MB request-body limit).

import type { NextRequest } from 'next/server'
import { getFiles } from '@/lib/files'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Admin-only live data: db() GET reads are Data-Cache-eligible (tag 'db', 1h). force-dynamic
// alone does NOT de-cache them (they set an explicit next.revalidate) — `fetchCache =
// 'force-no-store'` forces a live read so the list stays current after an upload/delete.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const items = await getFiles()
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read files', 500)
  }
}
