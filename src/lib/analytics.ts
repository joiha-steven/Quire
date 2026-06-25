// Privacy-light, self-hosted page-view analytics (Postgres `analytics_events`).
//
// WHY this design:
// - No cookies, no localStorage, no third party. A visitor is identified only by
//   a salted hash of (IP + user-agent), so NO raw IP / PII is ever stored — just
//   an opaque token used to count uniques. The salt is the server `AUTH_SECRET`,
//   so the token is stable enough for accurate unique counts but useless outside
//   this instance.
// - One row per view, plus two privacy-light source fields: the external referrer
//   HOST only (never the full URL/path/query; '' for direct/internal) and the
//   ISO country code from the edge. No IP, no fingerprint. Aggregation (totals /
//   top pages / daily series / trend / new-vs-returning / top referrers + countries)
//   is done in Postgres via the `analytics_summary` RPC, so the admin page is one
//   round-trip regardless of volume.
// - Bots are dropped by user-agent. Admin/API paths are never tracked, and the
//   owner's own visits are excluded in the route (requireOwner).
// - Retention: events are kept FOREVER (no purge) — the owner wants the full history.
// - Scroll depth: a separate `analytics_scroll` table holds one "% of page reached
//   before leaving" sample per post-leave, so a missed pagehide loses a depth
//   sample but never a view. Averaged per page + overall in the summary.

import { createHash } from 'node:crypto'
import { db } from '@/lib/db'

export type TopPage = { path: string; views: number; visitors: number; avgDepth: number }
export type DailyPoint = { day: string; views: number; visitors: number }
export type TopReferrer = { host: string; visitors: number }
export type TopCountry = { country: string; visitors: number }
export type AnalyticsSummary = {
  totalViews: number
  uniqueVisitors: number
  avgReadDepth: number
  topPages: TopPage[]
  daily: DailyPoint[]
  // Optional — present only once the analytics-deepening migration is applied
  // (scripts/migrations/2026-06-25-analytics-deepening.sql). The UI hides each
  // section until its data shows up, so pre-migration the page still works.
  prevViews?: number
  prevVisitors?: number
  returningVisitors?: number
  topReferrers?: TopReferrer[]
  topCountries?: TopCountry[]
}

const EMPTY: AnalyticsSummary = { totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, topPages: [], daily: [] }

// Common crawlers / preview bots — don't count them as readers.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|discord|headless|lighthouse|pagespeed|gtmetrix|monitor|uptime|curl|wget|python-requests|axios|node-fetch/i

export function isBot(ua: string): boolean {
  return !ua || BOT_RE.test(ua)
}

// Stable per-visitor token: salted hash of IP + UA. The salt never leaves the
// server, and the raw IP/UA are discarded — only this 16-byte hex is stored.
function visitorHash(ip: string, ua: string): string {
  const salt = process.env.AUTH_SECRET ?? 'quire'
  return createHash('sha256').update(`${salt}|${ip}|${ua}`).digest('hex').slice(0, 32)
}

// Normalize to a bare, bounded pathname (no query/hash). Returns null for paths
// we never track (admin, api) so the caller can skip cheaply.
function normalizePath(raw: string): string | null {
  let p = (raw || '').split('?')[0].split('#')[0].trim()
  if (!p.startsWith('/')) return null
  if (p.startsWith('/admin') || p.startsWith('/api')) return null
  if (p.length > 1) p = p.replace(/\/+$/, '') // strip trailing slash (keep "/")
  return p.slice(0, 512) || '/'
}

// Record one page view. Never throws (analytics must not break a page load).
// referrerHost = external referrer host only (no path/query; '' = direct/internal);
// country = ISO-3166 alpha-2 from the edge. Both are privacy-light and best-effort.
export async function recordView(
  rawPath: string,
  ip: string,
  ua: string,
  referrerHost = '',
  country = '',
): Promise<void> {
  try {
    if (isBot(ua)) return
    const path = normalizePath(rawPath)
    if (!path) return
    const base = { path, visitor: visitorHash(ip, ua) }
    // Try with the group-B columns; if they don't exist yet (pre-migration) the
    // insert errors, so we retry the base row — a view is never lost.
    const { error } = await db()
      .from('analytics_events')
      .insert({ ...base, referrer_host: referrerHost || null, country: country || null })
    if (error) await db().from('analytics_events').insert(base)
  } catch (error) {
    console.error(`[ERROR] analytics.recordView: ${(error as Error).message}`)
  }
}

// Record one scroll-depth sample (0–100, % of the page reached before leaving).
export async function recordScroll(rawPath: string, depth: number, ip: string, ua: string): Promise<void> {
  try {
    if (isBot(ua)) return
    const path = normalizePath(rawPath)
    if (!path) return
    const d = Math.max(0, Math.min(100, Math.round(depth)))
    await db().from('analytics_scroll').insert({ path, depth: d, visitor: visitorHash(ip, ua) })
  } catch (error) {
    console.error(`[ERROR] analytics.recordScroll: ${(error as Error).message}`)
  }
}

// Aggregated stats for the last `days` days. `bucket` controls the chart grain
// ('hour' for the 24h view, 'day' otherwise). One RPC round-trip; empty on failure.
export async function getAnalytics(days: number, bucket: 'hour' | 'day' = 'day'): Promise<AnalyticsSummary> {
  try {
    const sinceMs = Date.now() - days * 86_400_000
    const since = new Date(sinceMs).toISOString()
    const prevSince = new Date(sinceMs - days * 86_400_000).toISOString() // the window just before `since`
    // Try the extended RPC (trend + new/returning + referrers/countries); fall
    // back to the base 3-arg shape if the deepening migration isn't applied yet.
    let { data, error } = await db().rpc('analytics_summary', { since, top_n: 10, bucket, prev_since: prevSince })
    if (error) ({ data, error } = await db().rpc('analytics_summary', { since, top_n: 10, bucket }))
    if (error || !data) {
      if (error) console.error(`[ERROR] analytics.getAnalytics: ${error.message}`)
      return EMPTY
    }
    return data as AnalyticsSummary
  } catch (error) {
    console.error(`[ERROR] analytics.getAnalytics: ${(error as Error).message}`)
    return EMPTY
  }
}

// All-time total views per path (`{ "/slug": 12, … }`) for the content tables.
export async function getViewTotals(): Promise<Record<string, number>> {
  try {
    const { data, error } = await db().rpc('analytics_totals')
    if (error || !data) {
      if (error) console.error(`[ERROR] analytics.getViewTotals: ${error.message}`)
      return {}
    }
    return data as Record<string, number>
  } catch (error) {
    console.error(`[ERROR] analytics.getViewTotals: ${(error as Error).message}`)
    return {}
  }
}
