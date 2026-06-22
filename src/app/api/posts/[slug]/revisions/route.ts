// GET /api/posts/[slug]/revisions -> last few overwritten versions (owner only).
// Powers the editor's "time machine" restore list.

import type { NextRequest } from 'next/server'
import { getRevisions } from '@/lib/revisions'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Admin-only live data: db() GET reads are Data-Cache-eligible (tag 'db', 1h). force-dynamic
// alone does NOT de-cache them (they set an explicit next.revalidate) — `fetchCache =
// 'force-no-store'` forces a live read so the time-machine list shows the latest snapshots.
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function GET(req: NextRequest, ctx: RouteContext<'/api/posts/[slug]/revisions'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { slug } = await ctx.params
    const revisions = await getRevisions(slug)
    logRequest(req, 200, start)
    return ok(revisions)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read revisions', 500)
  }
}
