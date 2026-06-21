// POST /api/track -> record one page view (public, fire-and-forget). Body: { path }.
// Called from the <Track/> client island on every public page view. The insert
// runs after the response so it never delays the beacon. No PII is stored — see
// lib/analytics.ts (salted IP+UA hash only). Bots + admin/api paths are dropped.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordView, recordScroll } from '@/lib/analytics'
import { requireOwner } from '@/lib/api'

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Never count the owner's own visits to the public site — the beacon is
    // same-origin so it carries the session cookie; skip when it's the owner.
    if (await requireOwner()) return new Response(null, { status: 204 })
    const body = (await req.json().catch(() => ({}))) as { path?: unknown; depth?: unknown }
    const path = typeof body.path === 'string' ? body.path : ''
    if (path) {
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
      const ua = req.headers.get('user-agent') ?? ''
      // A `depth` payload is a scroll-depth sample (sent on leave); otherwise it
      // is a page view (sent on load).
      if (typeof body.depth === 'number') {
        const depth = body.depth
        after(() => recordScroll(path, depth, ip, ua))
      } else {
        after(() => recordView(path, ip, ua))
      }
    }
  } catch {
    /* never surface analytics errors to the client */
  }
  // 204 regardless — tracking is best-effort and must never affect the page.
  return new Response(null, { status: 204 })
}
