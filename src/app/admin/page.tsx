// Admin home: at-a-glance stats (posts, pages, media, storage, taxonomy, version)
// plus a System panel (hosting/region/env/commit, database + storage).
import pkg from '../../../package.json'
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { listBlobs, blobOrigin } from '@/lib/blob'
import { getSettings } from '@/lib/settings'
import { getBackupState } from '@/lib/backup-state'
import { countsByPosts } from '@/lib/comments'
import { getActivity } from '@/lib/activity'
import { db } from '@/lib/db'
import { Overview, type SystemInfo } from '@/components/admin/Overview'

// Gather the running-system facts shown in the Overview "System" panel. Best-effort:
// a DB hiccup just flips the status flag, it never breaks the dashboard. Each fact
// can carry an optional `href` so the value renders as a deep link to the relevant
// dashboard (Vercel project, Blob stores, Supabase project, the GitHub commit…).
async function getSystemInfo(): Promise<SystemInfo> {
  let dbReachable = true
  try {
    const { error } = await db().from('settings').select('id').limit(1)
    dbReachable = !error
  } catch {
    dbReachable = false
  }
  const env = process.env
  const sbRef = (env.SUPABASE_URL ?? '').match(/https:\/\/([^.]+)\./)?.[1] ?? '—'
  let blobHost = ''
  try {
    blobHost = new URL(blobOrigin()).host
  } catch {
    /* leave empty */
  }

  // Vercel injects these on a Git-connected deploy; absent locally.
  const sha = env.VERCEL_GIT_COMMIT_SHA ?? ''
  const repoOwner = env.VERCEL_GIT_REPO_OWNER ?? ''
  const repoSlug = env.VERCEL_GIT_REPO_SLUG ?? ''
  const prodUrl = env.VERCEL_PROJECT_PRODUCTION_URL ?? ''
  const nextVer = (pkg.dependencies as Record<string, string>).next?.replace(/^[\^~]/, '') ?? ''

  // Feature status: MCP on/off + whether backups are active (enabled AND connected).
  const [settings, backup] = await Promise.all([getSettings(), getBackupState()])

  return {
    mcpEnabled: settings.mcp.enabled,
    backupOn: settings.backups.enabled && !!backup.refreshToken,
    hosting: 'Vercel',
    hostingHref: 'https://vercel.com/dashboard',
    site: prodUrl || '—',
    siteHref: prodUrl ? `https://${prodUrl}` : undefined,
    region: env.VERCEL_REGION ?? 'sin1 (local)',
    env: env.VERCEL_ENV ?? 'development',
    branch: env.VERCEL_GIT_COMMIT_REF || '—',
    commit: sha.slice(0, 7) || '—',
    commitHref: sha && repoOwner && repoSlug ? `https://github.com/${repoOwner}/${repoSlug}/commit/${sha}` : undefined,
    database: `Supabase · ap-southeast-1 · ${sbRef}`,
    databaseHref: sbRef !== '—' ? `https://supabase.com/dashboard/project/${sbRef}` : undefined,
    dbReachable,
    storage: blobHost ? `Vercel Blob · ${blobHost}` : 'Vercel Blob',
    storageHref: 'https://vercel.com/dashboard/stores',
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
  const [posts, pages, blobs, system, commentCounts, recent] = await Promise.all([
    getIndex(),
    getPageIndex(),
    listBlobs(),
    getSystemInfo(),
    commentsOn ? countsByPosts() : Promise.resolve({} as Record<string, number>),
    activityOn ? getActivity(6) : Promise.resolve([]),
  ])
  const commentsTotal = Object.values(commentCounts).reduce((sum, n) => sum + n, 0)

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
    />
  )
}
