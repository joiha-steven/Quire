// Scheduled publishing sweep.
//
// A post saved with status 'published' and a FUTURE date is already hidden by the
// read layer (`isPublicallyVisible`) — no separate 'scheduled' status exists. It
// would still surface on its own within the 1h ISR window, but two things need a
// nudge to make it appear *on time*: the ISR list/post caches, and any 404 the edge
// (Cloudflare) cached for the not-yet-live URL. This sweep, run by the cron, detects
// posts that crossed their scheduled time within a bounded lookback window and does a
// full purge + warm so they go live promptly.
//
// The window is derived from the cron cadence (no watermark stored): the 5-min publish
// tick sweeps the last ~6 min, the hourly maintenance tick sweeps the last ~65 min as a
// backstop. Overlap is harmless — a purge is an idempotent superset (Invariant 1). A
// tick that is down during a crossing is covered by the hourly backstop, then by ISR.

import { db, liveOnly } from '@/lib/db'
import { purgeAndWarm } from '@/lib/revalidate'

// Lookback windows, slightly wider than each cadence to absorb tick jitter.
export const PUBLISH_TICK_LOOKBACK_MS = 6 * 60 * 1000 // 5-min tick + 1 min slack
export const HOURLY_LOOKBACK_MS = 65 * 60 * 1000 // hourly backstop + 5 min slack

type Crossable = { slug: string; date: string; status: string }

// Pure: which published posts crossed from future into live within (since, now].
// The single source of "did it go live" truth — DB-windowed reads only optimize this.
export function newlyLive(posts: Crossable[], since: number, now: number): string[] {
  return posts
    .filter((p) => p.status === 'published')
    .filter((p) => {
      const t = new Date(p.date).getTime()
      return !Number.isNaN(t) && t > since && t <= now
    })
    .map((p) => p.slug)
}

// Find posts that just became live and, if any, flush the edge + re-warm the origin.
// Returns how many crossed (0 = nothing to do, no purge). Never throws — the caller
// (cron) isolates it so a sweep failure can't skip other maintenance.
export async function sweepScheduled(lookbackMs: number): Promise<number> {
  const now = Date.now()
  const since = now - lookbackMs
  const { data, error } = await liveOnly(
    db()
      .from('posts')
      .select('slug,date,status')
      .eq('status', 'published')
      .gt('date', new Date(since).toISOString())
      .lte('date', new Date(now).toISOString()),
  )
  if (error) throw new Error(`sweepScheduled: ${error.message}`)
  const crossed = newlyLive((data ?? []) as Crossable[], since, now)
  if (crossed.length > 0) await purgeAndWarm()
  return crossed.length
}
