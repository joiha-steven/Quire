// POST /api/track -> record one page view (public, fire-and-forget). Body: { path }.
// Called from the <Track/> client island on every public page view. The insert
// runs after the response so it never delays the beacon. No PII is stored — see
// lib/analytics.ts (salted IP+UA hash only). Bots + admin/api paths are dropped.

import { after } from 'next/server'
import type { NextRequest } from 'next/server'
import { recordView, recordScroll } from '@/lib/analytics'
import { requireOwner } from '@/lib/api'
import { rateLimited, clientIp } from '@/lib/rate-limit'

export async function POST(req: NextRequest): Promise<Response> {
  try {
    // Never count the owner's own visits to the public site — the beacon is
    // same-origin so it carries the session cookie; skip when it's the owner.
    if (await requireOwner()) return new Response(null, { status: 204 })
    const body = (await req.json().catch(() => ({}))) as { path?: unknown; depth?: unknown; referrer?: unknown }
    const path = typeof body.path === 'string' ? body.path : ''
    // Generous per-IP cap so a real reader (page views + scroll beacons) never trips
    // it, but a script can't flood analytics_events. Silently drop over the limit.
    if (path && rateLimited(`track:${clientIp(req)}`, 240)) return new Response(null, { status: 204 })
    if (path) {
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
      const ua = req.headers.get('user-agent') ?? ''
      // A `depth` payload is a scroll-depth sample (sent on leave); otherwise it
      // is a page view (sent on load).
      if (typeof body.depth === 'number') {
        const depth = body.depth
        after(() => recordScroll(path, depth, ip, ua))
      } else {
        // Source attribution: referrer host (external only, set by the beacon on
        // session entry) + country from the CDN/proxy edge. Both best-effort, privacy-light.
        const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 255) : ''
        const country = (req.headers.get('cf-ipcountry') ?? '').trim()
        after(() => recordView(path, ip, ua, referrer, country))
      }
    }
  } catch {
    /* never surface analytics errors to the client */
  }
  // 204 regardless — tracking is best-effort and must never affect the page.
  return new Response(null, { status: 204 })
}
