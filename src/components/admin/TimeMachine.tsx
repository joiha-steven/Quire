'use client'

// Time machine: a modal listing the last few overwritten versions of a post.
// Restoring loads a revision back into the editor (non-destructive — the current
// version is itself snapshotted on the next save). Fetches GET /api/posts/[slug]/revisions.
import { useEffect, useState } from 'react'
import type { PostRevision, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { formatDateTimeShort } from '@/lib/utils'

type Props = {
  slug: string
  onRestore: (rev: PostRevision) => void
  onClose: () => void
}

// First ~180 chars of the body, stripped of markdown noise, as a preview.
function preview(content: string): string {
  const text = content.replace(/[#>*`_~\-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > 180 ? `${text.slice(0, 180)}…` : text
}

export function TimeMachine({ slug, onRestore, onClose }: Props) {
  const [revisions, setRevisions] = useState<PostRevision[] | null>(null)

  useEffect(() => {
    let active = true
    fetch(`/api/posts/${encodeURIComponent(slug)}/revisions`)
      .then((r) => r.json())
      .then((json: ApiResponse<PostRevision[]>) => {
        if (active) setRevisions(json.success && json.data ? json.data : [])
      })
      .catch(() => active && setRevisions([]))
    return () => {
      active = false
    }
  }, [slug])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl bg-white p-5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-lg font-bold">Cỗ máy thời gian</h2>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
        </div>
        <p className="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          Khôi phục một trong các phiên bản đã bị lưu đè gần đây. Bản hiện tại sẽ được giữ lại khi bạn lưu.
        </p>

        <div className="overflow-y-auto">
          {revisions === null ? (
            <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">Đang tải...</p>
          ) : revisions.length === 0 ? (
            <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">
              Chưa có phiên bản cũ nào. Các phiên bản sẽ xuất hiện sau khi bài viết được lưu đè.
            </p>
          ) : (
            <ul className="space-y-3">
              {revisions.map((rev, i) => (
                <li
                  key={rev.savedAt}
                  className="rounded-xl border border-neutral-200 p-4 dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {rev.title || '(không tiêu đề)'}
                      </div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400">
                        {i === 0 ? 'Mới nhất · ' : ''}{formatDateTimeShort(rev.savedAt)}
                      </div>
                    </div>
                    <Button variant="secondary" onClick={() => onRestore(rev)}>Khôi phục</Button>
                  </div>
                  {preview(rev.content) && (
                    <p className="mt-2 line-clamp-2 text-sm text-neutral-600 dark:text-neutral-300">
                      {preview(rev.content)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
