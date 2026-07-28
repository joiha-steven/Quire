// Admin home: at-a-glance stats (posts, pages, media, storage, taxonomy, version),
// dashboard widgets (30-day traffic, most-viewed posts, needs-attention), and a
// System panel (hosting, env, database + storage).
import pkg from '../../../package.json'
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { listBlobs } from '@/lib/blob'
import { getSettings } from '@/lib/settings'
import { getBackupState } from '@/lib/backup-state'
import { countsByPosts } from '@/lib/comments'
import { getActivity } from '@/lib/activity'
import { getAnalytics, getViewTotals } from '@/lib/analytics'
import { db } from '@/lib/db'
import { Overview, type SystemInfo } from '@/components/admin/Overview'
import type { DashboardData } from '@/components/admin/DashboardWidgets'

// Gather the running-system facts shown in the Overview "System" panel. Best-effort:
// a DB hiccup just flips the status flag, it never breaks the dashboard.
async function getSystemInfo(): Promise<SystemInfo> {
  let dbReachable = true
  try {
    const { error } = await db().from('settings').select('id').limit(1)
    dbReachable = !error
  } catch {
    dbReachable = false
  }
  const env = process.env
  let siteHost = ''
  try {
    siteHost = new URL(env.SITE_URL ?? env.AUTH_URL ?? '').host
  } catch {
    /* leave empty */
  }
  const nextVer = (pkg.dependencies as Record<string, string>).next?.replace(/^[\^~]/, '') ?? ''

  // Feature status: MCP on/off + whether backups are active (enabled AND connected).
  const [settings, backup] = await Promise.all([getSettings(), getBackupState()])

  return {
    mcpEnabled: settings.mcp.enabled,
    backupOn: settings.backups.enabled && !!backup.refreshToken,
    backupLastRun: backup.lastRunAt,
    hosting: 'Self-hosted',
    site: siteHost || '—',
    siteHref: siteHost ? `https://${siteHost}` : undefined,
    env: env.NODE_ENV ?? 'production',
    database: 'PostgreSQL (PostgREST)',
    dbReachable,
    storage: 'Local filesystem',
    runtime: `Node ${process.version.replace(/^v/, '')}`,
    framework: nextVer ? `Next.js ${nextVer}` : 'Next.js',
  }
}


// Tally a string[] field across posts into [name, count] pairs, busiest first.
function tally(values: string[]): { name: string; count: number }[] {
  const map = new Map<string, number>()
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1)
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export default async function AdminHome() {
  const settings = await getSettings()
  const commentsOn = settings.comments.enabled
  const activityOn = settings.features.activityLog
  const [posts, pages, blobs, system, commentCounts, recent, analytics30, viewTotals] = await Promise.all([
    getIndex(),
    getPageIndex(),
    listBlobs(),
    getSystemInfo(),
    commentsOn ? countsByPosts() : Promise.resolve({} as Record<string, number>),
    activityOn ? getActivity(6) : Promise.resolve([]),
    getAnalytics(30, 'day'),
    getViewTotals(),
  ])
  const commentsTotal = Object.values(commentCounts).reduce((sum, n) => sum + n, 0)

  // Dashboard widgets (traffic, top posts, needs-attention). Top posts maps the
  // all-time view totals (keyed by "/slug") back to titles, keeping only paths
  // that are real posts/pages. Drafts = unpublished posts + pages. (Unused-media
  // is intentionally NOT here — it's an O(posts) per-row content scan, far too
  // heavy for the home; it stays an on-demand check on the Media page.)
  const titleBySlug = new Map<string, string>()
  for (const p of posts) titleBySlug.set(p.slug, p.title)
  for (const p of pages) titleBySlug.set(p.slug, p.title)
  const topPosts = Object.entries(viewTotals)
    .map(([path, views]) => ({ slug: path.replace(/^\//, ''), views }))
    .filter((x) => titleBySlug.has(x.slug))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((x) => ({ slug: x.slug, views: x.views, title: titleBySlug.get(x.slug) ?? x.slug }))
  const drafts =
    posts.filter((p) => p.status !== 'published').length + pages.filter((p) => p.status !== 'published').length
  const dashboard: DashboardData = {
    traffic: {
      views30: analytics30.totalViews,
      visitors30: analytics30.uniqueVisitors,
      views7: analytics30.daily.slice(-7).reduce((sum, d) => sum + d.views, 0),
      spark: analytics30.daily.map((d) => d.views),
    },
    topPosts,
    needs: { drafts },
  }

  // SEO health: metadata-only signals over PUBLISHED posts (cheap — no body scan).
  const published = posts.filter((p) => p.status === 'published')
  const seo = {
    published: published.length,
    noExcerpt: published.filter((p) => !p.excerpt?.trim()).length,
    noImage: published.filter((p) => !p.featuredImage).length,
  }
  // Traffic sources (present once the analytics-deepening migration is applied).
  const sources = {
    referrers: (analytics30.topReferrers ?? []).map((r) => ({ label: r.host, visitors: r.visitors })),
    countries: (analytics30.topCountries ?? []).map((c) => ({ label: c.country, visitors: c.visitors })),
  }

  // Media blobs split into originals vs derived variants (thumb + -1024/-1600
  // AVIF/WebP, named by convention), plus the files/ attachment+icon+font blobs.
  const isVariant = (p: string) => /-(?:thumb|\d+)\.(?:avif|webp)$/.test(p)
  const mediaBlobs = blobs.filter((b) => b.pathname.startsWith('media/') && !b.pathname.endsWith('_index.json'))
  const variantCount = mediaBlobs.filter((b) => isVariant(b.pathname)).length
  const originalCount = mediaBlobs.length - variantCount
  const fileCount = blobs.filter((b) => b.pathname.startsWith('files/')).length
  const totalBytes = blobs.reduce((sum, b) => sum + b.size, 0)

  return (
    <Overview
      posts={posts.length}
      pages={pages.length}
      comments={commentsTotal}
      originals={originalCount}
      variants={variantCount}
      files={fileCount}
      totalBytes={totalBytes}
      categories={tally(posts.flatMap((p) => p.categories))}
      tags={tally(posts.flatMap((p) => p.tags))}
      recent={recent}
      activityEnabled={activityOn}
      version={pkg.version}
      system={system}
      dashboard={dashboard}
      seo={seo}
      sources={sources}
    />
  )
}
