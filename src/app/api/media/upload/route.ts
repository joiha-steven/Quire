// POST /api/media/upload -> server-mediated image upload for the LOCAL storage
// driver (owner only). Multipart form: one or more "file" parts. The browser sends
// the bytes here (no client-direct-to-store path off Vercel); the route writes them
// via the storage facade, makes the thumb + dims (addMediaBatch), then defers the
// heavy variants — the same post-upload shape as /api/media/register. On a Node
// self-host there is no 4.5MB body cap, so large photos are fine.
import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { addMediaBatch, finalizeVariants } from '@/lib/media'
import { collapseBlob } from '@/lib/blob'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const maxDuration = 60 // thumbnailing a big batch can take a moment

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif']

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
      return fail('No files provided', 400)
    }
    const inputs: { filename: string; body: ArrayBuffer; contentType: string }[] = []
    for (const f of files) {
      const contentType = f.type || ''
      if (!IMAGE_TYPES.includes(contentType)) {
        logRequest(req, 415, start)
        return fail('unsupported_type', 415)
      }
      inputs.push({ filename: f.name, body: await f.arrayBuffer(), contentType })
    }
    const uploaded = await addMediaBatch(inputs)
    const rasters = uploaded.map((m) => collapseBlob(m.url)).filter((p) => /\.(jpe?g|png)$/i.test(p))
    after(() => finalizeVariants(rasters))
    after(() => logActivity('media.upload', `${uploaded.length} image(s)`))
    logRequest(req, 201, start)
    return ok(uploaded, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to upload media', 500)
  }
}
