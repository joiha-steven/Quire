// Admin analytics. Without ?path: the overview (totals, engagement, time series,
// top pages, sources + audience). With ?path=/slug: that page's drill-down. Data
// comes from the Postgres analytics_* RPCs via getAnalytics / getPageAnalytics
// (see lib/analytics.ts for the privacy-light design).
import { getAnalytics, getPageAnalytics, type Bucket } from '@/lib/analytics'
import { getIndex } from '@/lib/posts'
import { getPageIndex } from '@/lib/pages'
import { AnalyticsView, type Range } from '@/components/admin/AnalyticsView'
import { AnalyticsPageDetail } from '@/components/admin/AnalyticsPageDetail'

const RANGES = [1, 7, 30, 365] as const

// Chart grain per range: hour for 24h, day for a week/month, month for a year.
function bucketFor(days: Range): Bucket {
  if (days === 1) return 'hour'
  if (days === 365) return 'month'
  return 'day'
}

export default async function AnalyticsPage({ searchParams }: PageProps<'/admin/analytics'>) {
  const { range, path } = await searchParams
  const days: Range = RANGES.includes(Number(range) as Range) ? (Number(range) as Range) : 30
  const bucket = bucketFor(days)

  // Map "/slug" -> title so pages read as titles, not raw paths (both surfaces).
  const [posts, pages] = await Promise.all([getIndex(), getPageIndex()])
  const titles: Record<string, string> = {}
  for (const p of posts) titles[`/${p.slug}`] = p.title
  for (const p of pages) titles[`/${p.slug}`] = p.title

  const target = typeof path === 'string' ? path : ''
  if (target) {
    const detail = await getPageAnalytics(target, days, bucket)
    return <AnalyticsPageDetail data={detail} title={titles[target] ?? target} range={days} />
  }

  const data = await getAnalytics(days, bucket)
  return <AnalyticsView data={data} range={days} titles={titles} />
}
