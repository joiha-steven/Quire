'use client'

// Admin comments table: content, post, time, name, source, delete. Delete is a
// soft delete (moves to Trash); the row drops from the list on success.
import { useState } from 'react'
import type { AdminComment, ApiResponse, CommentProvider } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { formatDateTimeShort } from '@/lib/utils'
import { useAdminT } from './I18nProvider'

function providerLabel(p: CommentProvider, t: ReturnType<typeof useAdminT>): string {
  if (p === 'google') return t.commentsFromGoogle
  if (p === 'facebook') return t.commentsFromFacebook
  return t.commentsFromManual
}

export function CommentsTable({ initial }: { initial: AdminComment[] }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [rows, setRows] = useState(initial)

  async function handleDelete(id: number) {
    if (!confirm(t.commentsConfirmDelete)) return
    try {
      const res = await fetch(`/api/comments/${id}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setRows((prev) => prev.filter((c) => c.id !== id))
      notify(t.movedToTrash)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  if (rows.length === 0) {
    return (
      <div>
        <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.commentsNavTitle}</h1>
        <p className="py-16 text-center text-neutral-500 dark:text-neutral-400">{t.commentsEmpty}</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">{t.commentsNavTitle}</h1>
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <table className="w-full text-sm">
          <thead className="whitespace-nowrap border-b border-neutral-200 bg-neutral-50 text-left text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900">
            <tr>
              <th className="px-4 py-3 font-medium">{t.commentsColContent}</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">{t.commentsColPost}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.commentsColTime}</th>
              <th className="px-4 py-3 font-medium">{t.commentsColName}</th>
              <th className="hidden px-4 py-3 font-medium sm:table-cell">{t.commentsColFrom}</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="max-w-xs px-4 py-3">
                  <p className="line-clamp-2 text-neutral-700 dark:text-neutral-300">{c.content}</p>
                </td>
                <td className="hidden max-w-[12rem] truncate px-4 py-3 md:table-cell">
                  <a href={`/${c.postSlug}`} target="_blank" rel="noopener" className="text-neutral-500 hover:underline dark:text-neutral-400">
                    {c.postTitle}
                  </a>
                </td>
                <td className="hidden whitespace-nowrap px-4 py-3 text-neutral-500 sm:table-cell dark:text-neutral-400">
                  {formatDateTimeShort(c.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-neutral-800 dark:text-neutral-200">{c.name}</div>
                  {c.email && <div className="text-xs text-neutral-400 dark:text-neutral-500">{c.email}</div>}
                </td>
                <td className="hidden px-4 py-3 sm:table-cell">
                  <span className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                    {providerLabel(c.provider, t)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
                  >
                    {t.commentsColDelete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
