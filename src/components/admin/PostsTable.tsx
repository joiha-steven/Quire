'use client'

// Posts list (no chrome): rows with per-row edit/delete. Tabs + heading +
// "new" button live in ContentDashboard, which renders this.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Post, ApiResponse } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { formatDateTimeShort } from '@/lib/utils'
import { RowActions, StatusPill } from './RowActions'
import { useAdminT } from './I18nProvider'

export function PostsTable({ initialPosts }: { initialPosts: Post[] }) {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const [posts, setPosts] = useState(initialPosts)

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

  if (posts.length === 0) {
    return <p className="py-16 text-center text-neutral-500 dark:text-neutral-400">{t.noPosts}</p>
  }

  return (
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
          {posts.map((p) => (
            <tr key={p.slug} className="border-b border-neutral-100 dark:border-neutral-800 last:border-0">
              <td className="px-4 py-3 font-medium">
                <Link href={`/admin/editor/${p.slug}`} className="hover:underline">
                  {p.title || t.untitled}
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatusPill published={p.status === 'published'} label={p.status === 'published' ? t.statusPublished : t.statusDraft} />
              </td>
              <td className="px-4 py-3 whitespace-nowrap text-neutral-500 dark:text-neutral-400">{formatDateTimeShort(p.date)}</td>
              <td className="px-4 py-3 text-neutral-500 dark:text-neutral-400">{p.categories.join(', ')}</td>
              <td className="px-4 py-3">
                <RowActions editHref={`/admin/editor/${p.slug}`} onDelete={() => handleDelete(p.slug)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
