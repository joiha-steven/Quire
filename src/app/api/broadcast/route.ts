// Newsletter broadcast (owner only). GET = the exact email a subscriber would get, for
// the admin preview pane; POST = actually send it to every confirmed subscriber.
//
// Deliberately NOT under /api/newsletter/*: that prefix is the public confirm /
// unsubscribe / pixel family (allow-listed in middleware), and a send endpoint must
// stay behind the edge owner guard.

import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { previewBroadcast, broadcastPosts, BroadcastError } from '@/lib/broadcast'
import { logActivity } from '@/lib/activity'
import { ok, fail, logRequest, logError, requireOwner } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// A BroadcastError carries a stable machine code the admin UI maps to a message; an
// unexpected failure stays a 500.
const failed = (e: unknown): { status: number; code: string } =>
  e instanceof BroadcastError ? { status: 400, code: e.message } : { status: 500, code: 'broadcast_failed' }

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    // Repeated ?slug= — several posts go out as ONE digest, so the preview takes the
    // same list the send will.
    const slugs = req.nextUrl.searchParams.getAll('slug').filter(Boolean)
    if (slugs.length === 0) {
      logRequest(req, 400, start)
      return fail('missing_slug', 400)
    }
    const preview = await previewBroadcast(slugs)
    logRequest(req, 200, start)
    return ok(preview)
  } catch (error) {
    const { status, code } = failed(error)
    if (status === 500) logError(req, error)
    logRequest(req, status, start)
    return fail(code, status)
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  const start = Date.now()
  try {
    if (!(await requireOwner())) {
      logRequest(req, 401, start)
      return fail('Unauthorized', 401)
    }
    const body = (await req.json().catch(() => ({}))) as { slugs?: unknown; force?: unknown }
    const slugs = Array.isArray(body.slugs) ? body.slugs.filter((s): s is string => typeof s === 'string' && !!s) : []
    if (slugs.length === 0) {
      logRequest(req, 400, start)
      return fail('missing_slug', 400)
    }
    const result = await broadcastPosts(slugs, { force: body.force === true })
    after(() => logActivity('newsletter.send', `${slugs.join(',')} — ${result.sent}/${result.recipients}`))
    logRequest(req, 200, start)
    return ok(result)
  } catch (error) {
    const { status, code } = failed(error)
    if (status === 500) logError(req, error)
    logRequest(req, status, start)
    return fail(code, status)
  }
}
