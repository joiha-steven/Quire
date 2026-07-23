// POST /api/series -> rename/remove a series across its posts, or reorder its parts (owner only).
// Body: { action: 'rename', name, newName } | { action: 'delete', name } | { action: 'reorder', name, order: string[] }
import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { updateSeries, reorderSeries } from '@/lib/series'
import { revalidateEverything } from '@/lib/revalidate'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

// Rewriting many posts' series can take a while on a large blog.
export const maxDuration = 60

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json()) as {
      action?: string
      name?: string
      newName?: string
      order?: string[]
    }
    const name = body.name?.trim()
    if (!name) {
      logRequest(req, 400, start)
      return fail('name is required', 400)
    }

    let changed = 0
    let detail = ''
    if (body.action === 'rename') {
      const newName = body.newName?.trim() ?? ''
      if (!newName) {
        logRequest(req, 400, start)
        return fail('newName is required to rename', 400)
      }
      changed = await updateSeries(name, newName)
      detail = `"${name}" → "${newName}"`
    } else if (body.action === 'delete') {
      changed = await updateSeries(name, null)
      detail = `"${name}" (removed)`
    } else if (body.action === 'reorder') {
      const order = Array.isArray(body.order) ? body.order.filter((s): s is string => typeof s === 'string') : []
      if (!order.length) {
        logRequest(req, 400, start)
        return fail('order is required to reorder', 400)
      }
      changed = await reorderSeries(name, order)
      detail = `"${name}" reordered`
    } else {
      logRequest(req, 400, start)
      return fail('unknown action', 400)
    }

    revalidateEverything()
    after(() => logActivity('series.update', `${detail} · ${changed} post(s)`))
    logRequest(req, 200, start)
    return ok({ changed })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to update series', 500)
  }
}
