'use client'

// Admin home dashboard: stat cards + taxonomy breakdown + running version.
import { formatBytes } from '@/lib/utils'
import { useAdminT } from './I18nProvider'

type Taxo = { name: string; count: number }

type Props = {
  posts: number
  pages: number
  mediaCount: number
  totalBytes: number
  categories: Taxo[]
  tags: Taxo[]
  version: string
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

export function Overview({ posts, pages, mediaCount, totalBytes, categories, tags, version }: Props) {
  const t = useAdminT()
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t.overviewTitle}</h1>
        <a
          href="https://github.com/joiha-steven/vibeblog/releases"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-neutral-100 px-3 py-1 text-xs text-neutral-500 transition-colors hover:bg-neutral-200 hover:text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
        >
          vibeblog v{version}
        </a>
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
    </div>
  )
}
