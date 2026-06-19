'use client'

// Dashboard table: filter tabs + per-row edit/delete.
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { Post, PostStatus, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatDateVi } from '@/lib/utils'

type Filter = 'all' | PostStatus

const TABS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'published', label: 'Đã đăng' },
  { key: 'draft', label: 'Bản nháp' },
]

export function PostsTable({ initialPosts }: { initialPosts: Post[] }) {
  const router = useRouter()
  const { notify } = useToast()
  const [posts, setPosts] = useState(initialPosts)
  const [filter, setFilter] = useState<Filter>('all')

  const visible = posts.filter((p) => filter === 'all' || p.status === filter)

  async function handleDelete(slug: string) {
    if (!confirm('Xóa bài viết này? Hành động không thể hoàn tác.')) return
    try {
      const res = await fetch(`/api/posts/${slug}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setPosts((prev) => prev.filter((p) => p.slug !== slug))
      notify('Đã xóa')
      router.refresh()
    } catch {
      notify('Xóa thất bại', 'error')
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-neutral-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                filter === t.key ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Link href="/admin/editor">
          <Button>Viết bài mới</Button>
        </Link>
      </div>

      {visible.length === 0 ? (
        <p className="py-16 text-center text-neutral-500">Chưa có bài viết nào.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">Tiêu đề</th>
                <th className="px-4 py-3 font-medium">Trạng thái</th>
                <th className="px-4 py-3 font-medium">Ngày</th>
                <th className="px-4 py-3 font-medium">Danh mục</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.map((p) => (
                <tr key={p.slug} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{p.title || '(không tiêu đề)'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        p.status === 'published'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {p.status === 'published' ? 'Đã đăng' : 'Bản nháp'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-neutral-500">{formatDateVi(p.date)}</td>
                  <td className="px-4 py-3 text-neutral-500">{p.categories.join(', ')}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/admin/editor/${p.slug}`}
                      className="text-neutral-600 hover:text-neutral-900"
                    >
                      Chỉnh sửa
                    </Link>
                    <button
                      onClick={() => handleDelete(p.slug)}
                      className="ml-4 text-red-600 hover:text-red-700"
                    >
                      Xóa
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
