// Post series / collections. A series is just a name shared by several posts, each
// with an explicit `seriesOrder`; there is no separate series table. The public "series
// box" on a post and the /series/[slug] listing read these. Public posts only (a draft
// part never shows), built on the already-cached getPublicPosts / getIndex reads.

import type { Post } from '@/types'
import { getPublicPosts, getIndex } from '@/lib/posts'
import { slugify } from '@/lib/utils'

export type SeriesInfo = {
  name: string
  slug: string
  posts: Post[] // ordered
  currentIndex: number
  prev?: Post
  next?: Post
}

// Order within a series: explicit order first, chronological as the tiebreak. Pure.
export function orderSeries(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) =>
      (a.seriesOrder ?? 0) - (b.seriesOrder ?? 0) ||
      new Date(a.date).getTime() - new Date(b.date).getTime(),
  )
}

// The series a post belongs to, with its ordered public siblings + prev/next. Null if
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
    prev: posts[currentIndex - 1],
    next: posts[currentIndex + 1],
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
