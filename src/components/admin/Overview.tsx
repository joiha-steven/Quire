'use client'

// Admin home dashboard: stat cards (posts, pages, comments, media, storage) +
// quick actions + recent activity + taxonomy breakdown + a System reference panel.
import Link from 'next/link'
import type { ActivityEntry } from '@/lib/activity'
import { formatBytes, formatDateTimeShort } from '@/lib/utils'
import { Card, PageHeader, StatCard } from './kit'
import { DashboardWidgets, type DashboardData } from './DashboardWidgets'
import { useAdminT } from './I18nProvider'

type Taxo = { name: string; count: number }

export type SystemInfo = {
  hosting: string
  hostingHref?: string
  site: string
  siteHref?: string
  env: string
  region: string
  branch: string
  commit: string
  commitHref?: string
  database: string
  databaseHref?: string
  dbReachable: boolean
  storage: string
  storageHref?: string
  runtime: string
  framework: string
  mcpEnabled: boolean
  backupOn: boolean
}

// Shared style for the small header pills (version + license) so they stay identical.
const PILL =
  'rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'

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
}

function TaxoList({ title, items, empty }: { title: string; items: Taxo[]; empty: string }) {
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{empty}</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {items.map((it) => (
            <li
              key={it.name}
              className="flex items-center gap-1.5 rounded-full bg-neutral-100 px-3 py-1 text-sm dark:bg-neutral-800"
            >
              <span className="text-neutral-700 dark:text-neutral-200">{it.name}</span>
              <span className="rounded-full bg-neutral-200 px-1.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                {it.count}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

// Quick actions — the few things the owner reaches for most, one click from home.
function QuickActions() {
  const t = useAdminT()
  const actions = [
    { href: '/admin/editor', label: t.newPost },
    { href: '/admin/page-editor', label: t.newPage },
    { href: '/admin/media', label: t.navMedia },
    { href: '/admin/settings', label: t.navSettings },
  ]
  return (
    <Card title={t.quickTitle}>
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-sm font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
          >
            {a.label}
          </Link>
        ))}
      </div>
    </Card>
  )
}

// Recent activity — the last few admin mutations, linking to the full log.
function RecentActivity({ recent, enabled }: { recent: ActivityEntry[]; enabled: boolean }) {
  const t = useAdminT()
  return (
    <Card
      title={t.recentActivity}
      actions={
        <Link href="/admin/log" className="text-xs text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200">
          {t.recentViewAll}
        </Link>
      }
    >
      {!enabled || recent.length === 0 ? (
        <p className="text-sm text-neutral-400 dark:text-neutral-500">{t.logEmpty}</p>
      ) : (
        <ul className="space-y-2">
          {recent.map((e) => (
            <li key={e.id} className="flex items-center gap-2 text-sm">
              <span className="shrink-0 rounded-md bg-neutral-100 px-2 py-0.5 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
                {e.action}
              </span>
              <span className="min-w-0 flex-1 truncate text-neutral-600 dark:text-neutral-300">{e.detail}</span>
              <span className="shrink-0 whitespace-nowrap text-xs text-neutral-400 dark:text-neutral-500">
                {formatDateTimeShort(e.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function SystemCard({ system }: { system: SystemInfo }) {
  const t = useAdminT()
  const rows: { label: string; value: string; ok?: boolean; href?: string }[] = [
    { label: t.sysHosting, value: system.hosting, href: system.hostingHref },
    { label: t.sysSite, value: system.site, href: system.siteHref },
    { label: t.sysEnv, value: system.env },
    { label: t.sysRegion, value: system.region },
    { label: t.sysBranch, value: system.branch },
    { label: t.sysCommit, value: system.commit, href: system.commitHref },
    { label: t.sysFramework, value: system.framework },
    { label: t.sysRuntime, value: system.runtime },
    { label: t.sysDatabase, value: system.database, href: system.databaseHref },
    { label: t.sysDbStatus, value: system.dbReachable ? t.sysReachable : t.sysUnreachable, ok: system.dbReachable },
    { label: t.sysStorage, value: system.storage, href: system.storageHref },
    { label: t.sysMcp, value: system.mcpEnabled ? t.sysOn : t.sysOff, ok: system.mcpEnabled || undefined },
    { label: t.sysBackup, value: system.backupOn ? t.sysOn : t.sysOff, ok: system.backupOn || undefined },
  ]
  return (
    <Card title={t.sysTitle}>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-neutral-100 py-1 dark:border-neutral-800/60">
            <dt className="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">{r.label}</dt>
            <dd
              className={`truncate text-right text-sm font-medium ${
                r.ok === false ? 'text-red-600 dark:text-red-400' : r.ok === true ? 'text-green-600 dark:text-green-400' : 'text-neutral-800 dark:text-neutral-100'
              }`}
              title={r.value}
            >
              {r.href ? (
                <a href={r.href} target="_blank" rel="noopener noreferrer" className="underline decoration-neutral-300 underline-offset-2 hover:decoration-neutral-600 dark:decoration-neutral-600 dark:hover:decoration-neutral-300">
                  {r.value}
                </a>
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

export function Overview({
  posts, pages, comments, originals, variants, files, totalBytes,
  categories, tags, recent, activityEnabled, version, system, dashboard,
}: Props) {
  const t = useAdminT()
  return (
    <div className="space-y-6">
      <PageHeader
        title={t.overviewTitle}
        actions={
          // Version + license pills share ONE class so they can't drift. The MIT
          // pill links to the LICENSE — the platform code is open source (the blog
          // content it publishes is the owner's, all rights reserved).
          <>
            <a href="https://github.com/joiha-steven/Quire" target="_blank" rel="noopener noreferrer" className={PILL}>
              <span className="font-semibold">quire</span>blog v{version}
            </a>
            <a href="https://github.com/joiha-steven/Quire/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" title={t.licenseTitle} className={PILL}>
              MIT
            </a>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label={t.statPosts} value={posts} href="/admin/content" />
        <StatCard label={t.statPages} value={pages} href="/admin/content" />
        <StatCard label={t.statComments} value={comments} href="/admin/comments" />
        <StatCard label={t.statMedia} value={originals} sub={`${variants} ${t.statVariants} · ${files} ${t.statFiles}`} href="/admin/media" />
        <StatCard label={t.statStorage} value={formatBytes(totalBytes)} />
      </div>

      <DashboardWidgets data={dashboard} />

      <QuickActions />

      <RecentActivity recent={recent} enabled={activityEnabled} />

      <div className="grid gap-4 sm:grid-cols-2">
        <TaxoList title={`${t.statCategories} (${categories.length})`} items={categories} empty={t.statEmpty} />
        <TaxoList title={`${t.statTags} (${tags.length})`} items={tags} empty={t.statEmpty} />
      </div>

      <SystemCard system={system} />
    </div>
  )
}
