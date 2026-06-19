// GET /api/media -> media manifest (public read)

import type { NextRequest } from 'next/server'
import { getMedia } from '@/lib/media'
import { ok, fail, logRequest, logError } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    const items = await getMedia()
    logRequest(req, 200, start)
    return ok(items)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read media', 500)
  }
}
