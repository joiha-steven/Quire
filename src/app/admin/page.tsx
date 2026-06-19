// Admin home: at-a-glance stats (posts, pages, media, storage, taxonomy, version).
import pkg from '../../../package.json'
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { listBlobs } from '@/lib/blob'
import { Overview } from '@/components/admin/Overview'

export const dynamic = 'force-dynamic'

// Tally a string[] field across posts into [name, count] pairs, busiest first.
function tally(values: string[]): { name: string; count: number }[] {
  const map = new Map<string, number>()
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1)
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export default async function AdminHome() {
  const [posts, pages, blobs] = await Promise.all([getIndex(), getPageIndex(), listBlobs()])

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
    />
  )
}
