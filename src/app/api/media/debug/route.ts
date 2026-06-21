// GET /api/media/debug?url=... -> owner-only delete diagnostic.
// Reports whether a delete of the given URL would match a manifest entry, plus
// the manifest size, a sample of stored URLs, and the configured media base —
// ground truth for debugging a "stuck" delete. Reports only, never mutates.

import type { NextRequest } from 'next/server'
import { debugDelete } from '@/lib/media'
import { getSettings } from '@/lib/settings'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const url = new URL(req.url).searchParams.get('url') ?? ''
    const settings = await getSettings()
    const diag = await debugDelete(url)
    logRequest(req, 200, start)
    return ok({
      url,
      ...diag,
      mediaBaseUrlSetting: settings.mediaBaseUrl || null,
      blobPublicBaseEnv: process.env.BLOB_PUBLIC_BASE || null,
    })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Debug failed', 500)
  }
}
