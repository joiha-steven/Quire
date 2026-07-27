// One page's drill-down, ported from the `analytics_page` plpgsql function.
//
// Same helpers as the summary, with a path filter, so the two can never disagree about
// what "unique visitors" or "average dwell" mean. The frozen tree had the definitions
// written out twice inside one SQL file, which is exactly how they drift.

import { bucketRanges, type Bucket } from '@/analytics/buckets'
import {
  dailySeries, depthBuckets, engagement, topCountries, topReferrers, windowCounts,
} from '@/analytics/aggregate'
import { EMPTY_PAGE, reportTz, type PageSummary } from '@/analytics/types'

// The original hard-coded 10 for both lists in the per-page function, where the summary
// took a parameter. Kept as-is.
const PAGE_TOP_N = 10

export async function getPageAnalytics(path: string, days: number, bucket: Bucket = 'day'): Promise<PageSummary> {
  try {
    const now = Date.now()
    const since = now - days * 86_400_000
    const prevSince = since - days * 86_400_000

    const current = windowCounts(since, null, path)
    const previous = windowCounts(prevSince, since, path)
    const { avgReadDepth, avgDwellMs } = engagement(since, path)

    return {
      path,
      totalViews: current.views,
      uniqueVisitors: current.visitors,
      avgReadDepth,
      avgDwellMs,
      prevViews: previous.views,
      prevVisitors: previous.visitors,
      daily: dailySeries(bucketRanges(since, now, bucket, reportTz()), path),
      topReferrers: topReferrers(since, PAGE_TOP_N, path),
      topCountries: topCountries(since, PAGE_TOP_N, path),
      depthBuckets: depthBuckets(since, path),
    }
  } catch (error) {
    console.error(`[ERROR] analytics.getPageAnalytics: ${(error as Error).message}`)
    return EMPTY_PAGE(path)
  }
}
