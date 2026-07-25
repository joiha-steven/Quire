// Newsletter broadcast (owner only). GET = the exact email a subscriber would get, for
// the admin preview pane; POST = actually send it to every confirmed subscriber.
//
// Deliberately NOT under /api/newsletter/*: that prefix is the public confirm /
// unsubscribe / pixel family (allow-listed in middleware), and a send endpoint must
// stay behind the edge owner guard.

import type { NextRequest } from 'next/server'
import { after } from 'next/server'
import { previewBroadcast, broadcastPost, BroadcastError } from '@/lib/broadcast'
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
    const slug = req.nextUrl.searchParams.get('slug') ?? ''
    if (!slug) {
      logRequest(req, 400, start)
      return fail('missing_slug', 400)
    }
    const preview = await previewBroadcast(slug)
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
    const body = (await req.json().catch(() => ({}))) as { slug?: unknown; force?: unknown }
    const slug = typeof body.slug === 'string' ? body.slug : ''
    if (!slug) {
      logRequest(req, 400, start)
      return fail('missing_slug', 400)
    }
    const result = await broadcastPost(slug, { force: body.force === true })
    after(() => logActivity('newsletter.send', `${slug} — ${result.sent}/${result.recipients}`))
    logRequest(req, 200, start)
    return ok(result)
  } catch (error) {
    const { status, code } = failed(error)
    if (status === 500) logError(req, error)
    logRequest(req, status, start)
    return fail(code, status)
  }
}
