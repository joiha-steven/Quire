// GET  /api/redirects -> list redirects (owner only).
// POST /api/redirects -> create/replace a redirect by source (owner only).
// Owner-only; the middleware net blocks non-owners (not in isPublicApi). Live data:
// the list must reflect writes at once, so opt reads out of the Data Cache.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { getRedirects, saveRedirect, RedirectInputError } from '@/lib/redirects'
import { logActivity } from '@/lib/activity'
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
    const redirects = await getRedirects()
    logRequest(req, 200, start)
    return ok(redirects)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to list redirects', 500)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as {
      source?: unknown
      destination?: unknown
      permanent?: unknown
    }
    const source = typeof body.source === 'string' ? body.source : ''
    const destination = typeof body.destination === 'string' ? body.destination : ''
    const permanent = body.permanent !== false // default 301
    try {
      await saveRedirect({ source, destination, permanent })
    } catch (e) {
      if (e instanceof RedirectInputError) {
        logRequest(req, 400, start)
        return fail(e.message, 400)
      }
      throw e
    }
    after(() => logActivity('redirect.save', source))
    logRequest(req, 201, start)
    return ok({ ok: true }, 201)
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Failed to save redirect', 500)
  }
}
