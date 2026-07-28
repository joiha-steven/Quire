// POST /api/files/font -> upload one custom typeface (owner only). Multipart form:
// "file" (the font). Stored under files/ on Blob, separate from the media library
// and the Files table. Returns { url, family } for settings.customFont.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { uploadFont, isAllowedFontType } from '@/lib/files'
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
    if (!isAllowedFontType(file.name)) {
      logRequest(req, 415, start)
      return fail('unsupported_type', 415)
    }
    const weightRaw = Number(form.get('weight'))
    const weight = [400, 500, 600, 700].includes(weightRaw) ? weightRaw : 400
    const result = await uploadFont(file.name, weight, await file.arrayBuffer(), file.type || '')
    after(() => logActivity('font.upload', result.family))
    logRequest(req, 201, start)
    return ok(result, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to upload font', 500)
  }
}
