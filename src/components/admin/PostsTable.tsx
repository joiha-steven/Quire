'use client'

// Dashboard table: filter tabs + per-row edit/delete.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Post, PostStatus, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDate } from '@/lib/i18n'
import { useAdminT, useAdminLang } from './I18nProvider'

type Filter = 'all' | PostStatus

export function PostsTable({ initialPosts }: { initialPosts: Post[] }) {
  const t = useAdminT()
  const lang = useAdminLang()
  const router = useRouter()
  const { notify } = useToast()
  const [posts, setPosts] = useState(initialPosts)
  const [filter, setFilter] = useState<Filter>('all')

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: t.filterAll },
    { key: 'published', label: t.filterPublished },
    { key: 'draft', label: t.filterDraft },
  ]

  const visible = posts.filter((p) => filter === 'all' || p.status === filter)

  async function handleDelete(slug: string) {
    if (!confirm(t.confirmDeletePost)) return
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setPosts((prev) => prev.filter((p) => p.slug !== slug))
      notify(t.deleted)
      router.refresh()
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.dashboardTitle}</h1>

      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                filter === tab.key ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Link href="/admin/editor">
          <Button>{t.newPost}</Button>
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-neutral-500 dark:text-neutral-400">{t.noPosts}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">{t.colTitle}</th>
                <th className="px-4 py-3 font-medium">{t.colStatus}</th>
                <th className="px-4 py-3 font-medium">{t.colDate}</th>
                <th className="px-4 py-3 font-medium">{t.colCategories}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.slug} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
                  <td className="px-4 py-3 font-medium">{p.title || t.untitled}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {p.status === 'published' ? t.statusPublished : t.statusDraft}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{formatDate(p.date, lang)}</td>
                  <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{p.categories.join(', ')}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/editor/${p.slug}`}
                      className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
                    >
                      {t.edit}
                    </Link>
                    <button
                      onClick={() => handleDelete(p.slug)}
                      className="ml-4 text-red-600 hover:text-red-700"
                    >
                      {t.delete}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
