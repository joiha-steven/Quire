// Admin analytics: total views, unique visitors, a daily series, and top pages
// over the chosen range. Data comes from the Postgres `analytics_events` table
// via getAnalytics (see lib/analytics.ts for the privacy-light design).
import { getAnalytics } from '@/lib/analytics'
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { AnalyticsView, type Range } from '@/components/admin/AnalyticsView'

const RANGES = [1, 7, 30, 365] as const

export default async function AnalyticsPage({ searchParams }: PageProps<'/admin/analytics'>) {
  const { range } = await searchParams
  const days: Range = RANGES.includes(Number(range) as Range) ? (Number(range) as Range) : 30
  // The 24h view is bucketed by hour; longer ranges by day.
  const [data, posts, pages] = await Promise.all([
    getAnalytics(days, days === 1 ? 'hour' : 'day'),
    getIndex(),
    getPageIndex(),
  ])
  // Map "/slug" -> title so Top pages reads as titles, not raw paths.
  const titles: Record<string, string> = {}
  for (const p of posts) titles[`/${p.slug}`] = p.title
  for (const p of pages) titles[`/${p.slug}`] = p.title
  return <AnalyticsView data={data} range={days} titles={titles} />
}
