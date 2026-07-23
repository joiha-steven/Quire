// GET /api/cron — scheduled maintenance (hourly; run it from cron / your panel).
// 1) Keep-alive ping: a trivial DB read that also serves as a liveness probe for the
//    self-hosted Postgres/PostgREST (and keeps any idle-suspending host warm).
// 2) Finalize sweep: generate any still-missing display variants (variants:false)
//    in case a post-save background `after()` didn't finish. The original always
//    renders meanwhile, so this only upgrades compression — never fixes a blank.

import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { finalizePendingVariants, finalizePendingThumbs } from '@/lib/media'
import { revalidateEverything, purgeAndWarm } from '@/lib/revalidate'
import { sweepScheduled, PUBLISH_TICK_LOOKBACK_MS, HOURLY_LOOKBACK_MS } from '@/lib/scheduled'
import { broadcastDuePosts } from '@/lib/broadcast'
import { maybeRunBackup } from '@/lib/backup'
import { ok, fail, logRequest, logError } from '@/lib/api'

// Variant encoding can take a while if a batch is pending.
export const maxDuration = 300

// Constant-time bearer check (don't leak the secret via response timing).
function bearerOk(header: string | null, secret: string): boolean {
  const a = Buffer.from(header ?? '')
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  // When CRON_SECRET is set, the cron job sends it as a Bearer token; reject others.
  // Unset = open (keep-alive still works on a fresh install); gen-keys sets one for
  // Docker so the default deployment is authenticated.
  const secret = process.env.CRON_SECRET
  if (secret && !bearerOk(req.headers.get('authorization'), secret)) {
    logRequest(req, 401, start)
    return fail('Unauthorized', 401)
  }
  try {
    // Keep-alive: any request keeps the project active; this is the cheapest read.
    await db().from('settings').select('id').limit(1)
    // Publish tick (`?publish=1`): the frequent (5-min) cron only flips due scheduled
    // posts live — no variant/backup sweep. Its short lookback matches the tick cadence.
    if (req.nextUrl.searchParams.get('publish') === '1') {
      const published = await sweepScheduled(PUBLISH_TICK_LOOKBACK_MS)
      // Email confirmed subscribers about any post that just went live (once).
      const broadcast = await broadcastDuePosts().catch((e) => {
        logError(req, e)
        return { posts: 0, emails: 0 }
      })
      logRequest(req, 200, start)
      return ok({ alive: true, published, broadcast })
    }
    // Deploy hook: `?purge=1` purges everything (Next paths + the Cloudflare zone) THEN
    // re-warms the origin ISR, so a code deploy — which runs no admin write — flushes the
    // edge and leaves the origin render cache primed. Same auth as the cron (CRON_SECRET).
    const doPurge = req.nextUrl.searchParams.get('purge') === '1'
    let warmed = 0
    if (doPurge) warmed = await purgeAndWarm()
    // Isolate the maintenance steps: a finalize failure must NOT skip the backup.
    let finalized = 0
    let thumbs = 0
    try {
      finalized = await finalizePendingVariants()
      thumbs = await finalizePendingThumbs()
    } catch (e) {
      logError(req, e)
    }
    // A finalized straggler changes rendered output (plain <img> → <picture>); the
    // pages that embed it were cached without those sources, so purge once when the
    // sweep actually did work. Coarse (no media→slug map here) but rare + superset-safe.
    if (finalized > 0) revalidateEverything()
    // Backstop for scheduled posts, in case the frequent publish tick was down; the
    // wider lookback covers the whole hour. Isolated so a failure can't skip the backup.
    let published = 0
    try {
      published = await sweepScheduled(HOURLY_LOOKBACK_MS)
    } catch (e) {
      logError(req, e)
    }
    // Broadcast backstop (in case the 5-min publish tick was down).
    const broadcast = await broadcastDuePosts().catch((e) => {
      logError(req, e)
      return { posts: 0, emails: 0 }
    })
    // Full-snapshot backup when enabled, connected, and the interval has elapsed.
    // Self-contained errors (never break keep-alive); logged so a silent scheduled
    // backup failure still surfaces in Admin → Log.
    const backup = await maybeRunBackup().catch((e) => {
      logError(req, e)
      return { ran: false, error: (e as Error).message }
    })
    logRequest(req, 200, start)
    return ok({ alive: true, purged: doPurge, warmed, finalized, thumbs, published, broadcast, backup })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Cron failed', 500)
  }
}
