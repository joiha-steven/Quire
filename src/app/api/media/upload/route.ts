// POST /api/media/upload -> upload one or more files (owner only)
// Accepts multipart/form-data with one or more "file" fields.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { addMediaBatch } from '@/lib/media'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Upload keeps the untouched ORIGINAL + a cheap thumbnail only; the heavy AVIF/WebP
// display variants are generated later, off the request (media.ts finalizeVariants,
// driven by the save route's after() + the hourly cron). Headroom for big files.
export const maxDuration = 60

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
    const inputs = await Promise.all(
      files.map(async (file) => ({
        filename: file.name,
        body: await file.arrayBuffer(),
        contentType: file.type || 'application/octet-stream',
      })),
    )
    let uploaded
    try {
      uploaded = await addMediaBatch(inputs)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Unsupported')) {
        logRequest(req, 415, start)
        return fail('unsupported_type', 415)
      }
      throw e
    }
    // No revalidation needed: the admin media library is dynamic, and a new
    // upload isn't on any public page until a post/page referencing it is saved.
    after(() => logActivity('media.upload', `${uploaded.length} file(s)`))
    logRequest(req, 201, start)
    return ok(uploaded, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to upload media', 500)
  }
}
