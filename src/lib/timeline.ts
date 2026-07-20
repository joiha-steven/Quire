// Group a newest-first post list into the infinite-scroll timeline: year → months,
// each month carrying its localized label and post count. Pure + synchronous so it
// unit-tests without a DOM. Assumes posts are already ordered newest-first
// (getPublicPosts) — months are taken contiguously, so an unsorted list would split a
// month into repeats (caller's contract).
import type { Post, SiteLang } from '@/types'
import { formatMonth } from '@/lib/i18n'

export type TimelineMonth = {
  key: string // 'YYYY-MM'
  label: string // localized month name (year shown separately)
  count: number // posts in the month
}
export type TimelineYear = { year: string; months: TimelineMonth[] }

export const monthKey = (iso: string): string => iso.slice(0, 7) // 'YYYY-MM' from an ISO date

export function buildTimeline(posts: Post[], lang: SiteLang): TimelineYear[] {
  const years: TimelineYear[] = []
  for (const p of posts) {
    const key = monthKey(p.date)
    const year = key.slice(0, 4)
    let yearBucket = years[years.length - 1]
    if (!yearBucket || yearBucket.year !== year) {
      yearBucket = { year, months: [] }
      years.push(yearBucket)
    }
    const lastMonth = yearBucket.months[yearBucket.months.length - 1]
    if (lastMonth && lastMonth.key === key) lastMonth.count++
    else yearBucket.months.push({ key, label: formatMonth(p.date, lang), count: 1 })
  }
  return years
}
