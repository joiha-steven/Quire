'use client'

// Dashboard widgets for the admin Overview: a traffic summary (30-day views +
// visitors with a sparkline), the most-viewed posts, and a "needs attention"
// list (drafts, unused media). All data is gathered server-side in
// app/admin/page.tsx and passed in — these are presentational only.
import Link from 'next/link'
import { Card } from './kit'
import { useAdminT } from './I18nProvider'

export type DashboardData = {
  // 30-day totals + the per-day view series for the sparkline; views7 is the last
  // 7 days summed from the same series (no extra query).
  traffic: { views30: number; visitors30: number; views7: number; spark: number[] }
  topPosts: { title: string; slug: string; views: number }[]
  // Counts the owner may want to act on. Comments have no moderation queue in
  // this app (publish-on-submit + soft-delete), so there is no "pending" here.
  needs: { drafts: number; unusedMedia: number }
}

// Tiny inline sparkline — no chart lib. Scales to the busiest day; uses
// currentColor so it follows the surrounding text colour in light/dark.
function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null
  const max = Math.max(...data, 1)
  const w = 100
  const h = 28
  const step = w / (data.length - 1)
  const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="h-7 w-full text-neutral-700 dark:text-neutral-300" aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

const VIEW_ALL =
  'text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200'

function TrafficCard({ traffic }: { traffic: DashboardData['traffic'] }) {
  const t = useAdminT()
  return (
    <Card
      title={t.dashTraffic}
      actions={<Link href="/admin/analytics" className={VIEW_ALL}>{t.dashViewAnalytics}</Link>}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-3xl font-bold tracking-tight tabular-nums">{traffic.views30.toLocaleString()}</div>
          <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{t.dashViews30}</div>
        </div>
        <div className="text-right">
          <div className="text-xl font-semibold tabular-nums">{traffic.visitors30.toLocaleString()}</div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">{t.dashVisitors30}</div>
        </div>
      </div>
      <div className="mt-3">
        <Sparkline data={traffic.spark} />
      </div>
      <div className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
        {t.dashViews7}: <span className="tabular-nums">{traffic.views7.toLocaleString()}</span>
      </div>
    </Card>
  )
}

function TopPostsCard({ posts }: { posts: DashboardData['topPosts'] }) {
  const t = useAdminT()
  return (
    <Card title={t.dashTopPosts}>
      {posts.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.dashTopEmpty}</p>
      ) : (
        <ol className="space-y-1">
          {posts.map((p, i) => (
            <li key={p.slug}>
              <Link
                href={`/${p.slug}`}
                className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span className="w-4 shrink-0 text-right text-xs font-medium text-neutral-400 dark:text-neutral-500">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-200">{p.title}</span>
                <span className="shrink-0 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">{p.views.toLocaleString()}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

function NeedsAttentionCard({ needs }: { needs: DashboardData['needs'] }) {
  const t = useAdminT()
  const items = [
    { label: t.dashDrafts, count: needs.drafts, href: '/admin/content' },
    { label: t.dashUnusedMedia, count: needs.unusedMedia, href: '/admin/media' },
  ]
  const allClear = items.every((i) => i.count === 0)
  return (
    <Card title={t.dashNeedsAttention}>
      {allClear ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.dashAllClear}</p>
      ) : (
        <ul className="space-y-1">
          {items.map((i) => (
            <li key={i.href}>
              <Link
                href={i.href}
                className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span className="text-neutral-600 dark:text-neutral-300">{i.label}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${
                    i.count > 0
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400'
                      : 'bg-neutral-100 text-neutral-400 dark:bg-neutral-800 dark:text-neutral-500'
                  }`}
                >
                  {i.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function DashboardWidgets({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrafficCard traffic={data.traffic} />
        </div>
        <NeedsAttentionCard needs={data.needs} />
      </div>
      <TopPostsCard posts={data.topPosts} />
    </div>
  )
}
