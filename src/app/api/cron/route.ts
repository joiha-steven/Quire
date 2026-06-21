// GET /api/cron — scheduled maintenance (Vercel Cron, hourly; see vercel.json).
// 1) Keep-alive ping: a trivial DB read so the Supabase free-tier project never
//    pauses (it pauses after ~7 days with no requests).
// 2) Finalize sweep: generate any still-missing display variants (variants:false)
//    in case a post-save background `after()` didn't finish. The original always
//    renders meanwhile, so this only upgrades compression — never fixes a blank.

import type { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { finalizePendingVariants, finalizePendingThumbs } from '@/lib/media'
import { ok, fail, logRequest, logError } from '@/lib/api'

// Variant encoding can take a while if a batch is pending.
export const maxDuration = 300

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  // When CRON_SECRET is set, Vercel Cron sends it as a Bearer token; reject others.
  const secret = process.env.CRON_SECRET
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    logRequest(req, 401, start)
    return fail('Unauthorized', 401)
  }
  try {
    // Keep-alive: any request keeps the project active; this is the cheapest read.
    await db().from('settings').select('id').limit(1)
    const finalized = await finalizePendingVariants()
    const thumbs = await finalizePendingThumbs()
    logRequest(req, 200, start)
    return ok({ alive: true, finalized, thumbs })
  } catch (error) {
    logError(req, error)
    logRequest(req, 500, start)
    return fail('Cron failed', 500)
  }
}
