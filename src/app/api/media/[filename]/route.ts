// DELETE /api/media/[filename] -> delete a media file (owner only)
// The blob URL is passed via the `url` search param (it is the manifest key).

import type { NextRequest } from 'next/server'
import { revalidatePath } from 'next/cache'
import { deleteMedia } from '@/lib/media'
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
    const items = await deleteMedia(url) // authoritative post-delete list
    revalidatePath('/', 'layout') // a deleted image may appear on a cached page
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete media', 500)
  }
}
