'use client'

// Analytics overview: range tabs + CSV export, headline metrics (views, visitors,
// avg time, avg read depth, bounce rate), a dual-series time chart, top pages
// (each links to its drill-down), traffic sources (channels + referrers), and the
// audience breakdown (countries, devices, browsers, systems) + read-depth split.
// Presentational — the server page fetches the data and passes it in; range tabs
// are plain links (?range=) since admin is already dynamic.
import Link from 'next/link'
import type { AnalyticsSummary, NameStat } from '@/lib/analytics'
import { PageHeader, Card, TableFrame, THEAD, TROW } from './kit'
import { BarList, StatTile, TrendChart, flag, formatDuration, type BarRow } from './analytics-kit'
import { useAdminT } from './I18nProvider'

const RANGES = [1, 7, 30, 365] as const
export type Range = (typeof RANGES)[number]

function toCsv(data: AnalyticsSummary): string {
  return ['date,views,visitors', ...data.daily.map((d) => `${d.day},${d.views},${d.visitors}`)].join('\n')
}

const DEPTH_LABELS = ['0–25%', '26–50%', '51–75%', '76–100%']

// Localized display name for a facet row ('Unknown' is the only translatable one).
function facetRows(stats: NameStat[] | undefined, unknown: string): BarRow[] {
  return (stats ?? []).map((s) => ({ key: s.name, label: s.name === 'Unknown' ? unknown : s.name, value: s.visitors }))
}

export function AnalyticsView({ data, range, titles }: { data: AnalyticsSummary; range: Range; titles: Record<string, string> }) {
  const t = useAdminT()
  const rangeLabel: Record<Range, string> = { 1: t.analyticsRange24h, 7: t.analyticsRange7, 30: t.analyticsRange30, 365: t.analyticsRange365 }
  const hasData = data.totalViews > 0

  const exportCsv = () => {
    const blob = new Blob([toCsv(data)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `analytics-${range}d.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const channelLabel: Record<string, string> = {
    direct: t.analyticsChannelDirect,
    search: t.analyticsChannelSearch,
    social: t.analyticsChannelSocial,
    referral: t.analyticsChannelReferral,
  }
  const bounce = data.uniqueVisitors > 0 && data.singlePageVisitors != null
    ? Math.round((data.singlePageVisitors / data.uniqueVisitors) * 100)
    : null

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.analyticsTitle}
        actions={
          <div className="flex items-center gap-2">
            <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`/admin/analytics?range=${r}`}
                  className={`rounded-md px-3 py-1 text-sm font-medium transition ${
                    r === range ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200'
                  }`}
                >
                  {rangeLabel[r]}
                </Link>
              ))}
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!hasData}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              {t.analyticsExportCsv}
            </button>
          </div>
        }
      />

      <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.analyticsPrivacyNote}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label={t.analyticsViews} value={data.totalViews} prev={data.prevViews} />
        <StatTile
          label={t.analyticsVisitors}
          value={data.uniqueVisitors}
          prev={data.prevVisitors}
          sub={
            data.returningVisitors != null ? (
              <>
                {t.analyticsNew} <span className="tabular-nums">{Math.max(0, data.uniqueVisitors - data.returningVisitors).toLocaleString()}</span>
                {' · '}
                {t.analyticsReturning} <span className="tabular-nums">{data.returningVisitors.toLocaleString()}</span>
              </>
            ) : undefined
          }
        />
        <StatTile label={t.analyticsAvgTime} value={formatDuration(data.avgDwellMs)} />
        <StatTile label={t.analyticsAvgDepth} value={`${data.avgReadDepth}%`} />
        <StatTile label={t.analyticsBounceRate} value={bounce == null ? '—' : `${bounce}%`} />
      </div>

      {!hasData ? (
        <p className="py-16 text-center text-neutral-400 dark:text-neutral-500">{t.analyticsNoData}</p>
      ) : (
        <>
          <Card>
            <TrendChart points={data.daily} peakLabel={t.analyticsPeak} viewsLabel={t.analyticsViews} visitorsLabel={t.analyticsVisitors} />
          </Card>

          {/* Top pages — by title where known, the bare path otherwise. Each row
              links to that page's drill-down. */}
          <TableFrame>
            <thead className={THEAD}>
              <tr>
                <th className="px-4 py-2.5 font-medium">{t.analyticsColPage}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t.analyticsViews}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t.analyticsVisitors}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t.analyticsColTime}</th>
                <th className="px-4 py-2.5 text-right font-medium">{t.analyticsColDepth}</th>
              </tr>
            </thead>
            <tbody>
              {data.topPages.map((p) => (
                <tr key={p.path} className={TROW}>
                  <td className="max-w-0 px-4 py-2.5">
                    <Link href={`/admin/analytics?path=${encodeURIComponent(p.path)}&range=${range}`} className="block truncate text-neutral-700 hover:underline dark:text-neutral-200" title={p.path}>
                      {titles[p.path] ?? p.path}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">{p.views.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600 dark:text-neutral-300">{p.visitors.toLocaleString()}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{formatDuration(p.avgDwellMs)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{p.avgDepth}%</td>
                </tr>
              ))}
            </tbody>
          </TableFrame>

          {/* Sources: traffic channels + top external referrers. */}
          <div className="grid gap-4 sm:grid-cols-2">
            <BarList
              title={t.analyticsChannels}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.channels ?? []).map((c) => ({ key: c.channel, label: channelLabel[c.channel] ?? c.channel, value: c.visitors }))}
            />
            <BarList
              title={t.analyticsTopReferrers}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.topReferrers ?? []).map((r) => ({ key: r.host, label: r.host, value: r.visitors }))}
            />
          </div>

          {/* Audience: countries + device / browser / OS breakdown. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <BarList
              title={t.analyticsTopCountries}
              unit={t.analyticsVisitors}
              empty={t.analyticsNoData}
              rows={(data.topCountries ?? []).map((c) => ({ key: c.country, label: `${flag(c.country)} ${c.country}`, value: c.visitors }))}
            />
            <BarList title={t.analyticsDevices} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.devices, t.analyticsUnknown)} />
            <BarList title={t.analyticsBrowsers} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.browsers, t.analyticsUnknown)} />
            <BarList title={t.analyticsSystems} unit={t.analyticsVisitors} empty={t.analyticsNoData} rows={facetRows(data.systems, t.analyticsUnknown)} />
          </div>

          {/* Engagement: read-depth distribution. */}
          {(data.depthBuckets?.length ?? 0) > 0 && (
            <BarList
              title={t.analyticsDepthDist}
              unit={t.analyticsUnitSamples}
              empty={t.analyticsNoData}
              rows={data.depthBuckets!.map((b) => ({ key: String(b.bucket), label: DEPTH_LABELS[b.bucket] ?? `${b.bucket}`, value: b.samples }))}
            />
          )}
        </>
      )}
    </div>
  )
}
