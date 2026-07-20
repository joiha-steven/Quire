// Group a newest-first post list into the infinite-scroll timeline: year → months,
// each month carrying its post count and the index of its FIRST post (so the rail can
// reveal up to and scroll to it). Pure + synchronous so it unit-tests without a DOM.
// Assumes posts are already ordered newest-first (getPublicPosts) — months are taken
// contiguously, so an unsorted list would split a month into repeats (caller's contract).
import type { Post, SiteLang } from '@/types'
import { formatMonth } from '@/lib/i18n'

export type TimelineMonth = {
  key: string // 'YYYY-MM'
  anchorId: string // DOM id of the month's first card ('tl-YYYY-MM')
  label: string // localized month name (year shown separately)
  firstIndex: number // index of the month's first post in the full list
  count: number // posts in the month
}
export type TimelineYear = { year: string; months: TimelineMonth[] }

export const monthKey = (iso: string): string => iso.slice(0, 7) // 'YYYY-MM' from an ISO date

export function buildTimeline(posts: Post[], lang: SiteLang): TimelineYear[] {
  const years: TimelineYear[] = []
  posts.forEach((p, i) => {
    const key = monthKey(p.date)
    const year = key.slice(0, 4)
    let yearBucket = years[years.length - 1]
    if (!yearBucket || yearBucket.year !== year) {
      yearBucket = { year, months: [] }
      years.push(yearBucket)
    }
    const lastMonth = yearBucket.months[yearBucket.months.length - 1]
    if (lastMonth && lastMonth.key === key) lastMonth.count++
    else yearBucket.months.push({ key, anchorId: `tl-${key}`, label: formatMonth(p.date, lang), firstIndex: i, count: 1 })
  })
  return years
}
