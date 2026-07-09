// GET /api/cron — scheduled maintenance (hourly; run it from cron / your panel).
// 1) Keep-alive ping: a trivial DB read so the Supabase free-tier project never
//    pauses (it pauses after ~7 days with no requests).
// 2) Finalize sweep: generate any still-missing display variants (variants:false)
//    in case a post-save background `after()` didn't finish. The original always
//    renders meanwhile, so this only upgrades compression — never fixes a blank.

import type { NextRequest } from 'next/server'
import { timingSafeEqual } from 'node:crypto'
import { db } from '@/lib/db'
import { finalizePendingVariants, finalizePendingThumbs } from '@/lib/media'
import { revalidateEverything } from '@/lib/revalidate'
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
    // Full-snapshot backup when enabled, connected, and the interval has elapsed.
    // Self-contained errors (never break keep-alive); logged so a silent scheduled
    // backup failure still surfaces in Admin → Log.
    const backup = await maybeRunBackup().catch((e) => {
      logError(req, e)
      return { ran: false, error: (e as Error).message }
    })
    logRequest(req, 200, start)
    return ok({ alive: true, finalized, thumbs, backup })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Cron failed', 500)
  }
}
