'use client'

// Posts list (no chrome): rows with per-row edit/delete. Tabs + heading +
// "new" button live in ContentDashboard, which renders this.
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Post, ApiResponse } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { formatDateTimeShort, foldAccents } from '@/lib/utils'
import { RowActions, StatusPill } from './RowActions'
import { useAdminT } from './I18nProvider'

type StatusFilter = 'all' | 'published' | 'draft'

export function PostsTable({
  initialPosts,
  views,
  commentCounts,
  commentsEnabled,
}: {
  initialPosts: Post[]
  views: Record<string, number>
  commentCounts: Record<string, number>
  commentsEnabled: boolean
}) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [posts, setPosts] = useState(initialPosts)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')

  async function handleDelete(slug: string) {
    if (!confirm(t.confirmDeletePost)) return
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setPosts((prev) => prev.filter((p) => p.slug !== slug))
      notify(t.movedToTrash)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  // Filter by status + a folded substring match over title/tags/categories.
  const needle = foldAccents(query.trim())
  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (status !== 'all' && p.status !== status) return false
      if (!needle) return true
      return foldAccents([p.title, p.tags.join(' '), p.categories.join(' ')].join(' ')).includes(needle)
    })
  }, [posts, status, needle])

  if (posts.length === 0) {
    return <p className="py-16 text-center text-neutral-500 dark:text-neutral-400">{t.noPosts}</p>
  }

  const statusTabs: { key: StatusFilter; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'published', label: t.statusPublished },
    { key: 'draft', label: t.statusDraft },
  ]

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.filterPlaceholder}
          aria-label={t.filterPlaceholder}
          className="min-h-10 min-w-0 flex-1 rounded-lg border border-neutral-200 bg-white px-3.5 py-2 text-sm shadow-sm outline-none placeholder:text-neutral-400 focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200 dark:border-neutral-700 dark:bg-neutral-900 dark:placeholder:text-neutral-500 dark:focus:ring-neutral-800"
        />
        <div className="flex gap-1 rounded-xl bg-neutral-200/70 p-1 dark:bg-neutral-800">
          {statusTabs.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStatus(s.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === s.key
                  ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white'
                  : 'text-neutral-500'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-16 text-center text-neutral-500 dark:text-neutral-400">{t.filterEmpty}</p>
      ) : (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.035)] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-none">
      <table className="w-full text-sm">
        <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 text-left text-neutral-500 whitespace-nowrap">
          <tr>
            <th className="px-4 py-3 font-medium">{t.colTitle}</th>
            <th className="px-4 py-3 font-medium">{t.colStatus}</th>
            <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">{t.colViews}</th>
            {commentsEnabled && <th className="hidden px-4 py-3 font-medium text-right sm:table-cell">{t.commentsCount}</th>}
            {/* Date + categories are secondary — hidden on narrow screens */}
            <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.colDate}</th>
            <th className="hidden px-4 py-3 font-medium md:table-cell">{t.colCategories}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.slug} className="border-b border-neutral-100 transition-colors hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/40 last:border-0">
              <td className="px-4 py-3 font-medium">
                <Link href={`/admin/editor/${p.slug}`} className="hover:underline">
                  {p.title || t.untitled}
                </Link>
                {p.categories.length > 0 && (
                  <div className="mt-1 text-xs font-normal text-neutral-400 md:hidden">{p.categories.join(', ')}</div>
                )}
              </td>
              <td className="px-4 py-3">
                <StatusPill published={p.status === 'published'} label={p.status === 'published' ? t.statusPublished : t.statusDraft} />
              </td>
              <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-500 sm:table-cell dark:text-neutral-400">{(views[`/${p.slug}`] ?? 0).toLocaleString()}</td>
              {commentsEnabled && (
                <td className="hidden px-4 py-3 text-right tabular-nums text-neutral-500 sm:table-cell dark:text-neutral-400">{(commentCounts[p.slug] ?? 0).toLocaleString()}</td>
              )}
              <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">{formatDateTimeShort(p.date)}</td>
              <td className="hidden px-4 py-3 text-neutral-500 md:table-cell dark:text-neutral-400">{p.categories.join(', ')}</td>
              <td className="px-4 py-3">
                <RowActions
                  editHref={`/admin/editor/${p.slug}`}
                  viewHref={p.status === 'published' ? `/${p.slug}` : undefined}
                  onDelete={() => handleDelete(p.slug)}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
      )}
    </>
  )
}
