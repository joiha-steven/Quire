// POST /api/files/upload -> upload one site icon (favicon / app icon), owner only.
// Multipart form: "file" (the image) + "kind" (favicon | app-icon). Stored under
// files/ on Blob, separate from the media library. Accepts .ico unlike media.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { uploadIcon, isAllowedIconType } from '@/lib/files'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const form = await req.formData()
    const file = form.get('file')
    if (!(file instanceof File)) {
      logRequest(req, 400, start)
      return fail('No file provided', 400)
    }
    const kindRaw = String(form.get('kind') || 'icon')
    const kind = kindRaw === 'favicon' || kindRaw === 'app-icon' ? kindRaw : 'icon'

    // Trust the browser MIME, but fall back to the .ico extension when it sends a
    // bare/empty type (common for favicons).
    let contentType = file.type || ''
    if (!isAllowedIconType(contentType) && /\.ico$/i.test(file.name)) contentType = 'image/x-icon'
    if (!isAllowedIconType(contentType)) {
      logRequest(req, 415, start)
      return fail('unsupported_type', 415)
    }

    const url = await uploadIcon(kind, await file.arrayBuffer(), contentType)
    after(() => logActivity('icon.upload', kind))
    logRequest(req, 201, start)
    return ok({ url }, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to upload icon', 500)
  }
}
