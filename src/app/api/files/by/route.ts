// DELETE /api/files/by?url=... -> delete one library file (owner only).
// The blob URL is passed via the `url` search param (it is the manifest key).
// Mirrors /api/media/by. Site icons (favicon/app-icon) are refused by deleteFile.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { deleteFile } from '@/lib/files'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function DELETE(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const url = new URL(req.url).searchParams.get('url')
    if (!url) {
      logRequest(req, 400, start)
      return fail('Missing url', 400)
    }
    const items = await deleteFile(url) // authoritative post-delete list
    after(() => logActivity('file.delete', url.split('/').pop() || url))
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete file', 500)
  }
}
