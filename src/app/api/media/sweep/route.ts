// POST /api/media/sweep -> delete media referenced nowhere (owner only).

import type { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { sweepUnusedMedia } from '@/lib/sweep'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Reads every post/page body to collect references.
export const maxDuration = 60

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const result = await sweepUnusedMedia()
    revalidateTag('media', { expire: 0 })
    logRequest(req, 200, start)
    return ok(result)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to sweep media', 500)
  }
}
