'use client'

// Quiet, action-first admin home. Detailed analytics, taxonomy and runtime data
// already have dedicated screens; the home only surfaces state that helps the
// owner decide what to do next.
import Link from 'next/link'
import type { ActivityEntry } from '@/lib/activity'
import { formatBytes, formatDateTimeShort } from '@/lib/utils'
import { PageHeader, StatCard } from './kit'
import { DashboardWidgets, type DashboardData } from './DashboardWidgets'
import { useAdminT } from './I18nProvider'

type Taxo = { name: string; count: number }
type SourceRow = { label: string; visitors: number }
export type SeoHealth = { published: number; noExcerpt: number; noImage: number }
export type TrafficSources = { referrers: SourceRow[]; countries: SourceRow[] }
export type SystemInfo = {
  hosting: string
  site: string
  siteHref?: string
  env: string
  database: string
  dbReachable: boolean
  storage: string
  runtime: string
  framework: string
  mcpEnabled: boolean
  backupOn: boolean
  backupLastRun?: string | null
}

type Props = {
  posts: number
  pages: number
  comments: number
  originals: number
  variants: number
  files: number
  totalBytes: number
  categories: Taxo[]
  tags: Taxo[]
  recent: ActivityEntry[]
  activityEnabled: boolean
  version: string
  system: SystemInfo
  dashboard: DashboardData
  seo: SeoHealth
  sources: TrafficSources
}

export function Overview(props: Props) {
  const t = useAdminT()
  const { posts, pages, comments, originals, totalBytes, recent, activityEnabled, version, system, dashboard } = props
  return (
    <div className="space-y-8">
      <PageHeader
        title={t.overviewTitle}
        actions={
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400">quireblog v{version}</span>
            <Link href="/admin/editor" className="bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900">{t.newPost}</Link>
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden border border-neutral-200 bg-neutral-200 sm:grid-cols-3 lg:grid-cols-5 dark:border-neutral-800 dark:bg-neutral-800">
        <StatCard label={t.statPosts} value={posts} href="/admin/content" />
        <StatCard label={t.statPages} value={pages} href="/admin/content" />
        <StatCard label={t.statComments} value={comments} href="/admin/comments" />
        <StatCard label={t.statMedia} value={originals} href="/admin/media" />
        <StatCard label={t.statStorage} value={formatBytes(totalBytes)} />
      </div>

      <DashboardWidgets data={dashboard} />

      <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t.recentActivity}</h2>
          <Link href="/admin/log" className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">{t.recentViewAll}</Link>
        </div>
        {!activityEnabled || recent.length === 0 ? (
          <p className="text-sm text-neutral-400">{t.logEmpty}</p>
        ) : (
          <ul className="divide-y divide-neutral-100 border-y border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
            {recent.slice(0, 6).map((entry) => (
              <li key={entry.id} className="grid gap-2 py-3 text-sm sm:grid-cols-[120px_minmax(0,1fr)_auto]">
                <span className={entry.action === 'error' ? 'font-medium text-neutral-900 dark:text-white' : 'text-neutral-500'}>{entry.action}</span>
                <span className="truncate text-neutral-700 dark:text-neutral-300">{entry.detail}</span>
                <time className="text-xs text-neutral-400">{formatDateTimeShort(entry.at)}</time>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 text-xs text-neutral-400 dark:border-neutral-800">
        <span>{system.dbReachable ? 'PostgreSQL · online' : 'PostgreSQL · offline'} · {system.storage}</span>
        {system.siteHref && <a href={system.siteHref} target="_blank" rel="noopener noreferrer" className="hover:text-neutral-900 dark:hover:text-white">{t.viewSite} ↗</a>}
      </div>
    </div>
  )
}
