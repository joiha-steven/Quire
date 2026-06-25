'use client'

// Analytics dashboard: range tabs, total views + unique visitors, a daily bar
// series, and the top pages. Presentational — the server page fetches the data
// and passes it in; the range tabs are plain links (?range=) since admin is
// already dynamic.
import Link from 'next/link'
import type { AnalyticsSummary } from '@/lib/analytics'
import { PageHeader } from './kit'
import { useAdminT } from './I18nProvider'

const RANGES = [1, 7, 30, 365] as const
export type Range = (typeof RANGES)[number]

// CSV of the daily series (date,views,visitors) for spreadsheets — built from
// the data already on screen, no server round-trip.
function toCsv(data: AnalyticsSummary): string {
  return ['date,views,visitors', ...data.daily.map((d) => `${d.day},${d.views},${d.visitors}`)].join('\n')
}

// Period-over-period change vs the previous window. Null when there is no prior
// data (pre-migration, or a zero baseline) — the arrow simply doesn't render.
function Trend({ cur, prev }: { cur: number; prev?: number }) {
  if (prev == null || prev === 0) return null
  const pct = Math.round(((cur - prev) / prev) * 100)
  if (pct === 0) return null
  const up = pct > 0
  return (
    <span className={`ml-2 align-middle text-xs font-medium ${up ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
      {up ? '▲' : '▼'} {Math.abs(pct)}%
    </span>
  )
}

// Flag emoji from an ISO 3166-1 alpha-2 code (regional indicators); '' if invalid.
function flag(cc: string): string {
  if (!/^[A-Za-z]{2}$/.test(cc)) return ''
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65))
}

export function AnalyticsView({ data, range, titles }: { data: AnalyticsSummary; range: Range; titles: Record<string, string> }) {
  const t = useAdminT()
  const rangeLabel: Record<Range, string> = { 1: t.analyticsRange24h, 7: t.analyticsRange7, 30: t.analyticsRange30, 365: t.analyticsRange365 }
  const maxDay = data.daily.reduce((m, d) => Math.max(m, d.views), 0) || 1
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-3xl font-bold tracking-tight">
            {data.totalViews.toLocaleString()}
            <Trend cur={data.totalViews} prev={data.prevViews} />
          </div>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.analyticsViews}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-3xl font-bold tracking-tight">
            {data.uniqueVisitors.toLocaleString()}
            <Trend cur={data.uniqueVisitors} prev={data.prevVisitors} />
          </div>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.analyticsVisitors}</div>
          {data.returningVisitors != null && (
            <div className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">
              {t.analyticsNew} <span className="tabular-nums">{Math.max(0, data.uniqueVisitors - data.returningVisitors).toLocaleString()}</span>
              {' · '}
              {t.analyticsReturning} <span className="tabular-nums">{data.returningVisitors.toLocaleString()}</span>
            </div>
          )}
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-3xl font-bold tracking-tight">{data.avgReadDepth}%</div>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.analyticsAvgDepth}</div>
        </div>
      </div>

      {!hasData ? (
        <p className="py-16 text-center text-neutral-400 dark:text-neutral-500">{t.analyticsNoData}</p>
      ) : (
        <>
          {/* Daily views — thin bars scaled to the busiest day, with the peak +
              first/last date labels for context. */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <div className="mb-2 text-xs text-neutral-400 dark:text-neutral-500">
              {t.analyticsPeak}: <span className="tabular-nums">{maxDay.toLocaleString()}</span>
            </div>
            <div className="flex h-32 items-end gap-px">
              {data.daily.map((d) => (
                <div
                  key={d.day}
                  title={`${d.day} · ${d.views} ${t.analyticsViews} · ${d.visitors} ${t.analyticsVisitors}`}
                  className="flex-1 rounded-t bg-neutral-300 transition-colors hover:bg-neutral-500 dark:bg-neutral-700 dark:hover:bg-neutral-400"
                  style={{ height: `${Math.max(2, (d.views / maxDay) * 100)}%` }}
                />
              ))}
            </div>
            {data.daily.length > 1 && (
              <div className="mt-1.5 flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
                <span className="tabular-nums">{data.daily[0].day}</span>
                <span className="tabular-nums">{data.daily[data.daily.length - 1].day}</span>
              </div>
            )}
          </div>

          {/* Top pages — by post/page title where known, the bare path otherwise.
              A real table with labelled columns so the numbers are unambiguous. */}
          <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 text-sm font-bold">{t.analyticsTopPages}</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-100 text-xs font-medium text-neutral-400 dark:border-neutral-800/60 dark:text-neutral-500">
                  <th className="py-1.5 text-left font-medium">{t.analyticsColPage}</th>
                  <th className="py-1.5 pl-3 text-right font-medium">{t.analyticsViews}</th>
                  <th className="py-1.5 pl-3 text-right font-medium">{t.analyticsVisitors}</th>
                  <th className="py-1.5 pl-3 text-right font-medium">{t.analyticsColDepth}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                {data.topPages.map((p) => (
                  <tr key={p.path}>
                    <td className="max-w-0 py-1.5 pr-3">
                      <a href={p.path} target="_blank" rel="noopener noreferrer" className="block truncate text-neutral-700 hover:underline dark:text-neutral-200" title={p.path}>
                        {titles[p.path] ?? p.path}
                      </a>
                    </td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-neutral-600 dark:text-neutral-300">{p.views.toLocaleString()}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-neutral-600 dark:text-neutral-300">{p.visitors.toLocaleString()}</td>
                    <td className="py-1.5 pl-3 text-right tabular-nums text-neutral-500 dark:text-neutral-400">{p.avgDepth}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Top referrers + countries — populated only after the analytics-
              deepening migration; each card hides until it has data. */}
          {((data.topReferrers?.length ?? 0) > 0 || (data.topCountries?.length ?? 0) > 0) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(data.topReferrers?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
                  <h2 className="mb-3 text-sm font-bold">{t.analyticsTopReferrers}</h2>
                  <div className="mb-1 flex items-center justify-between text-xs font-medium text-neutral-400 dark:text-neutral-500">
                    <span>{t.analyticsColSource}</span>
                    <span>{t.analyticsVisitors}</span>
                  </div>
                  <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                    {data.topReferrers!.map((r) => (
                      <li key={r.host} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-200" title={r.host}>{r.host}</span>
                        <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">{r.visitors.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(data.topCountries?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
                  <h2 className="mb-3 text-sm font-bold">{t.analyticsTopCountries}</h2>
                  <div className="mb-1 flex items-center justify-between text-xs font-medium text-neutral-400 dark:text-neutral-500">
                    <span>{t.analyticsColCountry}</span>
                    <span>{t.analyticsVisitors}</span>
                  </div>
                  <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
                    {data.topCountries!.map((c) => (
                      <li key={c.country} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-neutral-700 dark:text-neutral-200">
                          {flag(c.country)} {c.country}
                        </span>
                        <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">{c.visitors.toLocaleString()}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
