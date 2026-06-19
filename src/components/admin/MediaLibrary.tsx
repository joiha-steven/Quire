'use client'

// Media grid. Two modes:
// - 'page'   : full library with copy-URL / delete actions.
// - 'picker' : modal for choosing an image (calls onSelect with the URL).
import { useEffect, useState } from 'react'
import type { MediaItem, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatBytes, formatDateVi } from '@/lib/utils'
import { ImageUploader } from './ImageUploader'

type Props = {
  mode?: 'page' | 'picker'
  onSelect?: (url: string) => void
  onClose?: () => void
}

export function MediaLibrary({ mode = 'page', onSelect, onClose }: Props) {
  const { notify } = useToast()
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/media')
      .then((r) => r.json() as Promise<ApiResponse<MediaItem[]>>)
      .then((j) => setItems(j.data ?? []))
      .catch(() => notify('Không tải được thư viện', 'error'))
      .finally(() => setLoading(false))
  }, [notify])

  async function handleDelete(url: string) {
    if (!confirm('Xóa ảnh này? Hành động không thể hoàn tác.')) return
    try {
      const res = await fetch(`/api/media/by?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setItems((prev) => prev.filter((m) => m.url !== url))
      notify('Đã xóa')
    } catch {
      notify('Xóa thất bại', 'error')
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    notify('Đã sao chép URL')
  }

  const grid = (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {items.map((m) => (
        <figure key={m.url} className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          <button
            type="button"
            onClick={() => (mode === 'picker' ? onSelect?.(m.url) : copyUrl(m.url))}
            className="block aspect-square w-full bg-neutral-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.url} alt={m.filename} className="h-full w-full object-cover" />
          </button>
          <figcaption className="space-y-1 p-2 text-xs">
            <p className="truncate font-medium text-neutral-700" title={m.filename}>
              {m.filename}
            </p>
            <p className="text-neutral-400">
              {formatBytes(m.size)} · {formatDateVi(m.uploadedAt)}
            </p>
            {mode === 'page' && (
              <div className="flex gap-3 pt-1">
                <button onClick={() => copyUrl(m.url)} className="text-neutral-600 hover:text-neutral-900">
                  Sao chép URL
                </button>
                <button onClick={() => handleDelete(m.url)} className="text-red-600 hover:text-red-700">
                  Xóa
                </button>
              </div>
            )}
          </figcaption>
        </figure>
      ))}
    </div>
  )

  const body = (
    <div className="space-y-5">
      <ImageUploader onUploaded={(uploaded) => setItems((prev) => [...uploaded, ...prev])} />
      {loading ? (
        <p className="py-10 text-center text-neutral-400">Đang tải...</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-neutral-400">Chưa có ảnh nào.</p>
      ) : (
        grid
      )}
    </div>
  )

  if (mode === 'page') return body

  // Picker modal.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Thư viện ảnh</h2>
          <Button variant="ghost" onClick={onClose}>
            Đóng
          </Button>
        </div>
        <div className="overflow-y-auto">{body}</div>
      </div>
    </div>
  )
}
