// Admin analytics: total views, unique visitors, a daily series, and top pages
// over the chosen range. Data comes from the Postgres `analytics_events` table
// via getAnalytics (see lib/analytics.ts for the privacy-light design).
import { getAnalytics } from '@/lib/analytics'
import { AnalyticsView, type Range } from '@/components/admin/AnalyticsView'

const RANGES = [7, 30, 365] as const

export default async function AnalyticsPage({ searchParams }: PageProps<'/admin/analytics'>) {
  const { range } = await searchParams
  const days: Range = RANGES.includes(Number(range) as Range) ? (Number(range) as Range) : 30
  const data = await getAnalytics(days)
  return <AnalyticsView data={data} range={days} />
}
