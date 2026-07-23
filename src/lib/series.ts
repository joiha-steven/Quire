// Post series / collections. A series is just a name shared by several posts, each
// with an explicit `seriesOrder`; there is no separate series table. The public "series
// box" on a post and the /series/[slug] listing read these. Public posts only (a draft
// part never shows), built on the already-cached getPublicPosts / getIndex reads.

import type { Post } from '@/types'
import { db } from '@/lib/db'
import { getPublicPosts, getIndex } from '@/lib/posts'
import { slugify } from '@/lib/utils'
import { orderSeries } from '@/lib/series-order'

// Re-exported for server callers + tests; defined in the client-safe pure module.
export { orderSeries, seriesEntries, type SeriesEntry } from '@/lib/series-order'

export type SeriesInfo = {
  name: string
  slug: string
  posts: Post[] // ordered
  currentIndex: number
}

// The series a post belongs to, with its ordered public siblings. Null if
// the post has no series (or isn't public).
export async function getSeriesForPost(slug: string): Promise<SeriesInfo | null> {
  const all = await getPublicPosts()
  const current = all.find((p) => p.slug === slug)
  if (!current?.series) return null
  const posts = orderSeries(all.filter((p) => p.series === current.series))
  const currentIndex = posts.findIndex((p) => p.slug === slug)
  return {
    name: current.series,
    slug: slugify(current.series),
    posts,
    currentIndex,
  }
}

// All PUBLIC series with post counts (busiest first, ties alphabetical).
export async function getSeriesList(): Promise<{ name: string; slug: string; count: number }[]> {
  const all = await getPublicPosts()
  const counts = new Map<string, number>()
  for (const p of all) if (p.series) counts.set(p.series, (counts.get(p.series) ?? 0) + 1)
  return [...counts]
    .map(([name, count]) => ({ name, slug: slugify(name), count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

// Resolve a series slug → display name + ordered public posts (null name if no match).
export async function resolveSeries(slug: string): Promise<{ name: string | null; posts: Post[] }> {
  const all = await getPublicPosts()
  let name: string | null = null
  for (const p of all) {
    if (p.series && slugify(p.series) === slug) {
      name = p.series
      break
    }
  }
  if (!name) return { name: null, posts: [] }
  return { name, posts: orderSeries(all.filter((p) => p.series === name)) }
}

// Distinct series names across ALL posts incl. drafts — for the editor's autocomplete.
export async function getAllSeriesNames(): Promise<string[]> {
  const all = await getIndex()
  return [...new Set(all.map((p) => p.series).filter((s): s is string => !!s))].sort()
}

// Rename a series across ALL its posts, or remove it (newName null → clear series +
// reset order). Scalar column, so a single equality-matched UPDATE — no read-modify-write
// (unlike updateTerm's arrays). Returns posts changed. Rename into an existing name just
// merges (order ties break by date, same as everywhere).
export async function updateSeries(name: string, newName: string | null): Promise<number> {
  const clean = newName?.trim() || null
  const patch = clean ? { series: clean } : { series: null, series_order: 0 }
  const { data } = await db().from('posts').update(patch).eq('series', name).select('slug')
  return data?.length ?? 0
}

// Set series_order to match the given slug order (0-based) for one series. Only rows
// still in this series are touched; unknown slugs are no-ops. Returns rows changed.
export async function reorderSeries(name: string, orderedSlugs: string[]): Promise<number> {
  let changed = 0
  await Promise.all(
    orderedSlugs.map(async (slug, i) => {
      const { data } = await db()
        .from('posts')
        .update({ series_order: i })
        .eq('series', name)
        .eq('slug', slug)
        .select('slug')
      if (data?.length) changed++
    }),
  )
  return changed
}
