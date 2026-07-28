// POST /api/track: one page view, or one scroll-depth sample, from the reader's browser.
//
// Always answers 204, whatever happens. Analytics is best-effort by definition, and a
// beacon that can fail visibly is a beacon that can break a page load. Errors are logged
// on this side and never surfaced.
//
// No PII is stored: `recordView` keeps a salted hash of IP and user-agent, never either
// one. See `analytics/record.ts`.
//
// NOT YET PORTED: the frozen tree opens with `if (await requireOwner()) return 204`, so
// the owner's own reading is never counted. 2.0 has no session to ask until M3, so for now
// an owner reading their own blog counts as a reader. Tracked in docs/07-parity.md §8.

import type { Context } from 'hono'
import { recordScroll, recordView } from '@/analytics/record'
import { clientIp, rateLimited } from '@/server/rate-limit'

/**
 * Generous enough that a real reader never trips it (one view plus one depth sample per
 * page, plus whatever they read in a minute), tight enough that a script cannot flood
 * `analytics_events`. Over the limit is a silent drop, not an error: telling a flooder
 * they have been limited is telling them what to change.
 */
const PER_MINUTE = 240

type Payload = { path?: unknown; depth?: unknown; referrer?: unknown; dwell?: unknown }

export async function handleTrack(c: Context): Promise<Response> {
  try {
    const body = (await c.req.json().catch(() => ({}))) as Payload
    const path = typeof body.path === 'string' ? body.path : ''
    if (!path) return c.body(null, 204)

    const ip = clientIp(c.req.raw)
    if (rateLimited(`track:${ip}`, PER_MINUTE)) return c.body(null, 204)

    const ua = c.req.header('user-agent') ?? ''
    // Buffered in memory (Invariant 7), so neither of these touches the disk on the
    // request path and there is nothing to defer past the response.
    if (typeof body.depth === 'number') {
      const dwell = typeof body.dwell === 'number' ? body.dwell : undefined
      await recordScroll(path, body.depth, ip, ua, dwell)
    } else {
      // Source attribution: the referrer HOST only, sent by the beacon on session entry
      // and only when it is external, plus the country the CDN saw. Both privacy-light.
      const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 255) : ''
      const country = (c.req.header('cf-ipcountry') ?? '').trim()
      await recordView(path, ip, ua, referrer, country)
    }
  } catch (error) {
    console.error(`[ERROR] track: ${(error as Error).message}`)
  }
  return c.body(null, 204)
}
