// POST /api/cache/clear -> purge the whole public cache, then warm it (owner only).
// Public pages are ISR-cached (revalidate); this forces an immediate refresh of
// everything and re-renders the key pages so the next visitor gets a warm cache.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { revalidateEverything, warmCache } from '@/lib/revalidate'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Warming fetches several pages; give it room.
export const maxDuration = 60

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }

    // Purge every public route, then warm the home + newest detail pages so the
    // next visitor gets a warm cache. Warm is best-effort (never fails the call).
    revalidateEverything()
    const warmed = await warmCache(new URL(req.url).origin)

    after(() => logActivity('cache.clear'))
    logRequest(req, 200, start)
    return ok({ purged: true, warmed })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to clear cache', 500)
  }
}
