// POST /api/files/delete -> delete MANY library files at once (owner only).
// Body: { urls: string[] }. Site icons are skipped server-side. Returns the
// authoritative post-delete list. Mirrors /api/media/delete.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { deleteFilesBatch } from '@/lib/files'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { urls?: unknown }
    const urls = Array.isArray(body.urls) ? body.urls.filter((u): u is string => typeof u === 'string') : []
    if (urls.length === 0) {
      logRequest(req, 400, start)
      return fail('No urls provided', 400)
    }
    const items = await deleteFilesBatch(urls)
    after(() => logActivity('file.delete', `${urls.length} file(s)`))
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete files', 500)
  }
}
