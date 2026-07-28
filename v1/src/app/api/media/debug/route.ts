// GET /api/media/debug?url=... -> owner-only delete diagnostic.
// Reports whether a delete of the given URL would match a media row, plus the
// row count and a sample of stored paths — ground truth for a "stuck" delete.
// Reports only, never mutates.

import type { NextRequest } from 'next/server'
import { debugDelete } from '@/lib/media'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const url = new URL(req.url).searchParams.get('url') ?? ''
    const diag = await debugDelete(url)
    logRequest(req, 200, start)
    return ok({ url, ...diag })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Debug failed', 500)
  }
}
