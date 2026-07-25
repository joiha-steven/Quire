// GET /api/subscribers — list subscribers + counts (owner only). Live data: reflects
// sign-ups/confirms that happen out-of-band from the public routes.

import type { NextRequest } from 'next/server'
import { listSubscribers, subscriberCounts } from '@/lib/subscribers'
import { statsByEmail } from '@/lib/newsletter-log'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const [subscribers, counts, stats] = await Promise.all([listSubscribers(), subscriberCounts(), statsByEmail()])
    // Attach each address's send history (one rollup read, not a query per row).
    const rows = subscribers.map((s) => ({ ...s, stats: stats.get(s.email) ?? null }))
    logRequest(req, 200, start)
    return ok({ subscribers: rows, counts })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to list subscribers', 500)
  }
}
