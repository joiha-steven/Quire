// GET    /api/activity -> recent activity log entries (owner only)
// DELETE /api/activity -> clear the whole log (owner only)

import type { NextRequest } from 'next/server'
import { getActivity, clearActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const entries = await getActivity()
    logRequest(req, 200, start)
    return ok(entries)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to read activity log', 500)
  }
}

export async function DELETE(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    await clearActivity()
    logRequest(req, 200, start)
    return ok({ cleared: true })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to clear activity log', 500)
  }
}
