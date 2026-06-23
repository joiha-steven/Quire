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

export function AnalyticsView({ data, range }: { data: AnalyticsSummary; range: Range }) {
  const t = useAdminT()
  const rangeLabel: Record<Range, string> = { 1: t.analyticsRange24h, 7: t.analyticsRange7, 30: t.analyticsRange30, 365: t.analyticsRange365 }
  const maxDay = data.daily.reduce((m, d) => Math.max(m, d.views), 0) || 1
  const hasData = data.totalViews > 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={t.analyticsTitle}
        actions={
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
        }
      />

      <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.analyticsPrivacyNote}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-3xl font-bold tracking-tight">{data.totalViews.toLocaleString()}</div>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.analyticsViews}</div>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="text-3xl font-bold tracking-tight">{data.uniqueVisitors.toLocaleString()}</div>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.analyticsVisitors}</div>
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
          {/* Daily views — thin bars scaled to the busiest day. */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
          </div>

          {/* Top pages. */}
          <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
            <h2 className="mb-3 text-sm font-bold">{t.analyticsTopPages}</h2>
            <ul className="divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {data.topPages.map((p) => (
                <li key={p.path} className="flex items-center justify-between gap-3 py-1.5 text-sm">
                  <a href={p.path} target="_blank" rel="noopener noreferrer" className="min-w-0 truncate text-neutral-700 hover:underline dark:text-neutral-200" title={p.path}>
                    {p.path}
                  </a>
                  <span className="shrink-0 tabular-nums text-neutral-500 dark:text-neutral-400">
                    {p.views.toLocaleString()} · {p.visitors.toLocaleString()} · {p.avgDepth}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
