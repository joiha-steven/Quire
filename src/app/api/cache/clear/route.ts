// POST /api/cache/clear -> purge the whole public cache, then warm it (owner only).
// Public pages are ISR-cached (revalidate); this forces an immediate refresh of
// everything and re-renders the key pages so the next visitor gets a warm cache.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { purgeAndWarm } from '@/lib/revalidate'
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

    // Purge everything (origin ISR + the Cloudflare zone), THEN re-warm the origin ISR
    // (home + newest pages) so the next reader's cache miss renders fast.
    const warmed = await purgeAndWarm()

    after(() => logActivity('cache.clear'))
    logRequest(req, 200, start)
    return ok({ purged: true, warmed })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to clear cache', 500)
  }
}
