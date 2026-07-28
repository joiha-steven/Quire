// DELETE /api/subscribers/[id] — remove a subscriber (owner only).

import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { deleteSubscriber } from '@/lib/subscribers'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

export async function DELETE(req: NextRequest, ctx: RouteContext<'/api/subscribers/[id]'>): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const { id } = await ctx.params
    const num = Number(id)
    if (!Number.isInteger(num)) {
      logRequest(req, 400, start)
      return fail('Invalid id', 400)
    }
    await deleteSubscriber(num)
    after(() => logActivity('subscriber.delete', String(num)))
    logRequest(req, 200, start)
    return ok({ ok: true })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to delete subscriber', 500)
  }
}
