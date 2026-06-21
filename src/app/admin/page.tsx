// Admin home: at-a-glance stats (posts, pages, media, storage, taxonomy, version)
// plus a System panel (hosting/region/env/commit, database + storage).
import pkg from '../../../package.json'
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { listBlobs, blobOrigin } from '@/lib/blob'
import { db } from '@/lib/db'
import { Overview, type SystemInfo } from '@/components/admin/Overview'

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
  const sbRef = (process.env.SUPABASE_URL ?? '').match(/https:\/\/([^.]+)\./)?.[1] ?? '—'
  let storage = 'Vercel Blob'
  try {
    storage = `Vercel Blob · ${new URL(blobOrigin()).host}`
  } catch {
    /* leave default */
  }
  return {
    hosting: 'Vercel',
    region: process.env.VERCEL_REGION ?? 'sin1 (local)',
    env: process.env.VERCEL_ENV ?? 'development',
    commit: (process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || '—',
    database: `Supabase · ap-southeast-1 · ${sbRef}`,
    dbReachable,
    storage,
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
  const [posts, pages, blobs, system] = await Promise.all([
    getIndex(),
    getPageIndex(),
    listBlobs(),
    getSystemInfo(),
  ])

  const mediaBlobs = blobs.filter((b) => b.pathname.startsWith('media/') && !b.pathname.endsWith('_index.json'))
  const totalBytes = blobs.reduce((sum, b) => sum + b.size, 0)

  return (
    <Overview
      posts={posts.length}
      pages={pages.length}
      mediaCount={mediaBlobs.length}
      totalBytes={totalBytes}
      categories={tally(posts.flatMap((p) => p.categories))}
      tags={tally(posts.flatMap((p) => p.tags))}
      version={pkg.version}
      system={system}
    />
  )
}
