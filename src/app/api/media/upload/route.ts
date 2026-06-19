// POST /api/media/upload -> upload one or more files (owner only)
// Accepts multipart/form-data with one or more "file" fields.

import type { NextRequest } from 'next/server'
import type { MediaItem } from '@/types'
import { addMedia } from '@/lib/media'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const form = await req.formData()
    const files = form.getAll('file').filter((f): f is File => f instanceof File)
    if (files.length === 0) {
      logRequest(req, 400, start)
      return fail('No file provided', 400)
    }
    const uploaded: MediaItem[] = []
    for (const file of files) {
      const buffer = await file.arrayBuffer()
      uploaded.push(await addMedia(file.name, buffer, file.type || 'application/octet-stream'))
    }
    logRequest(req, 201, start)
    return ok(uploaded, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to upload media', 500)
  }
}
