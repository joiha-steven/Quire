'use client'

// Admin home dashboard: stat cards + taxonomy breakdown + running version.
import { formatBytes } from '@/lib/utils'
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
  originals: number
  variants: number
  files: number
  totalBytes: number
  categories: Taxo[]
  tags: Taxo[]
  version: string
  system: SystemInfo
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <div className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-neutral-400 dark:text-neutral-500">{sub}</div>}
    </div>
  )
}

function TaxoList({ title, items, empty }: { title: string; items: Taxo[]; empty: string }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
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
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <h2 className="mb-3 text-sm font-bold">{t.sysTitle}</h2>
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
    </div>
  )
}

export function Overview({ posts, pages, originals, variants, files, totalBytes, categories, tags, version, system }: Props) {
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
        <StatCard
          label={t.statMedia}
          value={originals}
          sub={`${variants} ${t.statVariants} · ${files} ${t.statFiles}`}
        />
        <StatCard label={t.statStorage} value={formatBytes(totalBytes)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TaxoList title={`${t.statCategories} (${categories.length})`} items={categories} empty={t.statEmpty} />
        <TaxoList title={`${t.statTags} (${tags.length})`} items={tags} empty={t.statEmpty} />
      </div>

      <SystemCard system={system} />
    </div>
  )
}
