// POST /api/media/register -> record metadata for images the browser already
// uploaded straight to Blob (owner only). Body: { items: [{ url, filename }] }.
// Reads each original back to make the thumbnail + dimensions, inserts the rows,
// then defers the heavy AVIF/WebP variants off the response.
import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { registerMediaBatch, finalizeVariants } from '@/lib/media'
import { collapseBlob } from '@/lib/blob'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const maxDuration = 60 // thumbnailing a big original can take a moment

type Item = { url: string; filename: string }

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { items?: unknown }
    const items = (Array.isArray(body.items) ? body.items : []).filter(
      (i): i is Item => !!i && typeof i.url === 'string' && typeof i.filename === 'string',
    )
    if (items.length === 0) {
      logRequest(req, 400, start)
      return fail('No items provided', 400)
    }
    const uploaded = await registerMediaBatch(items)
    // Generate display variants for the raster originals in the background.
    const rasters = uploaded.map((m) => collapseBlob(m.url)).filter((p) => /\.(jpe?g|png)$/i.test(p))
    after(() => finalizeVariants(rasters))
    after(() => logActivity('media.upload', `${uploaded.length} image(s)`))
    logRequest(req, 201, start)
    return ok(uploaded, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to register media', 500)
  }
}
