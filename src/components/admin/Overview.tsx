'use client'

// Admin home dashboard: stat cards + taxonomy breakdown + running version.
import { formatBytes } from '@/lib/utils'
import { useAdminT } from './I18nProvider'

type Taxo = { name: string; count: number }

export type SystemInfo = {
  hosting: string
  env: string
  region: string
  commit: string
  database: string
  dbReachable: boolean
  storage: string
}

// Shared style for the small header pills (version + license) so they stay identical.
const PILL =
  'rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'

type Props = {
  posts: number
  pages: number
  mediaCount: number
  totalBytes: number
  categories: Taxo[]
  tags: Taxo[]
  version: string
  system: SystemInfo
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
    </div>
  )
}

function TaxoList({ title, items, empty }: { title: string; items: Taxo[]; empty: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
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
    </div>
  )
}

function SystemCard({ system }: { system: SystemInfo }) {
  const t = useAdminT()
  const rows: { label: string; value: string; ok?: boolean }[] = [
    { label: t.sysHosting, value: system.hosting },
    { label: t.sysRegion, value: system.region },
    { label: t.sysEnv, value: system.env },
    { label: t.sysCommit, value: system.commit },
    { label: t.sysDatabase, value: system.database },
    { label: t.sysDbStatus, value: system.dbReachable ? t.sysReachable : t.sysUnreachable, ok: system.dbReachable },
    { label: t.sysStorage, value: system.storage },
  ]
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-sm font-bold">{t.sysTitle}</h2>
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-3 border-b border-neutral-100 py-1 dark:border-neutral-800/60">
            <dt className="text-sm text-neutral-500 dark:text-neutral-400">{r.label}</dt>
            <dd
              className={`text-right text-sm font-medium ${
                r.ok === false ? 'text-red-600 dark:text-red-400' : r.ok === true ? 'text-green-600 dark:text-green-400' : 'text-neutral-800 dark:text-neutral-100'
              }`}
            >
              {r.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Overview({ posts, pages, mediaCount, totalBytes, categories, tags, version, system }: Props) {
  const t = useAdminT()
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.overviewTitle}</h1>
        {/* Version + license pills share ONE class so they can't drift. The MIT
            pill links to the LICENSE — the platform code is open source (the blog
            content it publishes is the owner's, all rights reserved). */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/joiha-steven/vibeblog"
            target="_blank"
            rel="noopener noreferrer"
            className={PILL}
          >
            vibeblog v{version}
          </a>
          <a
            href="https://github.com/joiha-steven/vibeblog/blob/main/LICENSE"
            target="_blank"
            rel="noopener noreferrer"
            title={t.licenseTitle}
            className={PILL}
          >
            MIT
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={t.statPosts} value={posts} />
        <StatCard label={t.statPages} value={pages} />
        <StatCard label={t.statMedia} value={mediaCount} />
        <StatCard label={t.statStorage} value={formatBytes(totalBytes)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TaxoList title={t.statCategories} items={categories} empty={t.statEmpty} />
        <TaxoList title={t.statTags} items={tags} empty={t.statEmpty} />
      </div>

      <SystemCard system={system} />
    </div>
  )
}
