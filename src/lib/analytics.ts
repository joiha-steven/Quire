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
import { parseUa } from '@/lib/ua'

export type TopPage = { path: string; views: number; visitors: number; avgDepth: number; avgDwellMs?: number }
export type DailyPoint = { day: string; views: number; visitors: number }
export type TopReferrer = { host: string; visitors: number }
export type TopCountry = { country: string; visitors: number }
export type ChannelStat = { channel: string; visitors: number }
export type NameStat = { name: string; visitors: number } // device / browser / os facet
export type DepthBucket = { bucket: number; samples: number } // 0 = 0-25% … 3 = 76-100%
export type AnalyticsSummary = {
  totalViews: number
  uniqueVisitors: number
  avgReadDepth: number
  topPages: TopPage[]
  daily: DailyPoint[]
  // Optional — present only once the analytics-deepening / v2 migrations are
  // applied. The UI hides each section until its data shows up, so pre-migration
  // the page still works.
  prevViews?: number
  prevVisitors?: number
  returningVisitors?: number
  topReferrers?: TopReferrer[]
  topCountries?: TopCountry[]
  // v2 (2026-07-22-analytics-v2.sql): engagement, channels, audience facets.
  avgDwellMs?: number
  singlePageVisitors?: number
  channels?: ChannelStat[]
  devices?: NameStat[]
  browsers?: NameStat[]
  systems?: NameStat[]
  depthBuckets?: DepthBucket[]
}

// One page's drill-down (analytics_page RPC). Empty on failure.
export type PageSummary = {
  path: string
  totalViews: number
  uniqueVisitors: number
  avgReadDepth: number
  avgDwellMs: number
  prevViews?: number
  prevVisitors?: number
  daily: DailyPoint[]
  topReferrers: TopReferrer[]
  topCountries: TopCountry[]
  depthBuckets: DepthBucket[]
}

export type Bucket = 'hour' | 'day' | 'week' | 'month'

const EMPTY: AnalyticsSummary = { totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, topPages: [], daily: [] }
const EMPTY_PAGE = (path: string): PageSummary => ({
  path, totalViews: 0, uniqueVisitors: 0, avgReadDepth: 0, avgDwellMs: 0, daily: [], topReferrers: [], topCountries: [], depthBuckets: [],
})

// IANA zone the admin time buckets are truncated in (so "days" match local
// midnight, not UTC). Set ANALYTICS_TZ per instance; defaults to UTC. Validated
// loosely to keep a bad value from reaching Postgres as SQL.
function reportTz(): string {
  const tz = (process.env.ANALYTICS_TZ ?? '').trim()
  return /^[A-Za-z0-9_+/-]{1,40}$/.test(tz) ? tz : 'UTC'
}

// Common crawlers / preview bots — don't count them as readers.
const BOT_RE = /bot|crawl|spider|slurp|bingpreview|facebookexternalhit|embedly|quora|pinterest|vkshare|whatsapp|telegram|discord|headless|lighthouse|pagespeed|gtmetrix|monitor|uptime|curl|wget|python-requests|axios|node-fetch|gptbot|oai-searchbot|chatgpt|claudebot|claude-web|anthropic|ccbot|perplexity|bytespider|amazonbot|google-extended|meta-external|scrapy|semrush|ahrefs|dataforseo/i

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
    const { device, browser, os } = parseUa(ua)
    // Try with the extended columns; if they don't exist yet (pre-migration) the
    // insert errors, so we retry the base row — a view is never lost.
    const { error } = await db().from('analytics_events').insert({
      ...base,
      referrer_host: referrerHost || null,
      country: country || null,
      device,
      browser,
      os,
    })
    if (error) await db().from('analytics_events').insert(base)
  } catch (error) {
    console.error(`[ERROR] analytics.recordView: ${(error as Error).message}`)
  }
}

// Record one scroll-depth sample (0–100, % of page reached before leaving) plus
// an optional dwell time (ms on the page). Falls back to a dwell-less row if the
// v2 column isn't there yet, so a sample is never lost pre-migration.
export async function recordScroll(rawPath: string, depth: number, ip: string, ua: string, dwellMs?: number): Promise<void> {
  try {
    if (isBot(ua)) return
    const path = normalizePath(rawPath)
    if (!path) return
    const d = Math.max(0, Math.min(100, Math.round(depth)))
    const base = { path, depth: d, visitor: visitorHash(ip, ua) }
    const dwell = typeof dwellMs === 'number' && isFinite(dwellMs) ? Math.max(0, Math.min(86_400_000, Math.round(dwellMs))) : null
    const { error } = await db().from('analytics_scroll').insert({ ...base, dwell_ms: dwell })
    if (error) await db().from('analytics_scroll').insert(base)
  } catch (error) {
    console.error(`[ERROR] analytics.recordScroll: ${(error as Error).message}`)
  }
}

// Aggregated stats for the last `days` days. `bucket` controls the chart grain
// (hour for 24h, day for a week/month, month for a year). One RPC round-trip;
// empty on failure.
export async function getAnalytics(days: number, bucket: Bucket = 'day', topN = 10): Promise<AnalyticsSummary> {
  try {
    const sinceMs = Date.now() - days * 86_400_000
    const since = new Date(sinceMs).toISOString()
    const prevSince = new Date(sinceMs - days * 86_400_000).toISOString() // the window just before `since`
    // Try the v2 RPC (tz + engagement + channels + audience); fall back to the
    // base shape if only the pre-v2 migration is applied.
    let { data, error } = await db().rpc('analytics_summary', { since, top_n: topN, bucket, prev_since: prevSince, tz: reportTz() })
    if (error) ({ data, error } = await db().rpc('analytics_summary', { since, top_n: topN, bucket }))
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

// Per-page drill-down for the last `days` days (analytics_page RPC). Empty on
// failure or when the v2 migration isn't applied yet.
export async function getPageAnalytics(path: string, days: number, bucket: Bucket = 'day'): Promise<PageSummary> {
  try {
    const sinceMs = Date.now() - days * 86_400_000
    const since = new Date(sinceMs).toISOString()
    const prevSince = new Date(sinceMs - days * 86_400_000).toISOString()
    const { data, error } = await db().rpc('analytics_page', { page_path: path, since, bucket, prev_since: prevSince, tz: reportTz() })
    if (error || !data) {
      if (error) console.error(`[ERROR] analytics.getPageAnalytics: ${error.message}`)
      return EMPTY_PAGE(path)
    }
    return data as PageSummary
  } catch (error) {
    console.error(`[ERROR] analytics.getPageAnalytics: ${(error as Error).message}`)
    return EMPTY_PAGE(path)
  }
}

// All-time total views per path (`{ "/slug": 12, … }`) for the content tables.
export async function getViewTotals(): Promise<Record<string, number>> {
  try {
    // GET (not the default POST) so `db()` treats it as a cache-eligible read tagged `db`
    // — a public listing page reading this (the sidebar's "Most viewed") stays ISR/static
    // instead of bailing to dynamic. Allowed because `analytics_totals()` is STABLE. Admin
    // surfaces (force-no-store) still read it live.
    const { data, error } = await db().rpc('analytics_totals', {}, { get: true })
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
