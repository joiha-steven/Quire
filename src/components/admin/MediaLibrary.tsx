'use client'

// Media grid. Two modes:
// - 'page'   : full library; click a thumbnail to zoom, plus copy-URL / delete.
// - 'picker' : modal for choosing an image (calls onSelect with the URL).
import { useEffect, useRef, useState } from 'react'
import type { MediaItem, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { formatBytes, formatDateVi } from '@/lib/utils'
import { ImageUploader } from './ImageUploader'
import { useAdminT } from './I18nProvider'

type Props = {
  mode?: 'page' | 'picker'
  onSelect?: (url: string) => void
  onClose?: () => void
}

const PAGE = 50 // render this many, then load more on scroll (keeps it light)

export function MediaLibrary({ mode = 'page', onSelect, onClose }: Props) {
  const t = useAdminT()
  const { notify } = useToast()
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [zoom, setZoom] = useState<MediaItem | null>(null)
  const [visible, setVisible] = useState(PAGE)
  const sentinel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch('/api/media')
      .then((r) => r.json() as Promise<ApiResponse<MediaItem[]>>)
      .then((j) => setItems(j.data ?? []))
      .catch(() => notify(t.loadMediaFailed, 'error'))
      .finally(() => setLoading(false))
  }, [notify, t])

  // Infinite scroll: reveal another page when the sentinel comes into view.
  useEffect(() => {
    const el = sentinel.current
    if (!el || visible >= items.length) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setVisible((v) => v + PAGE)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [visible, items.length])

  async function handleDelete(url: string) {
    if (!confirm(t.confirmDeleteMedia)) return
    try {
      const res = await fetch(`/api/media/by?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setItems((prev) => prev.filter((m) => m.url !== url))
      notify(t.deleted)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    notify(t.copiedUrl)
  }

  const grid = (
    <>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
        {items.slice(0, visible).map((m) => (
          <figure key={m.url} className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
            <button
              type="button"
              // Page mode: click to zoom. Picker mode: click to select.
              onClick={() => (mode === 'picker' ? onSelect?.(m.url) : setZoom(m))}
              className="block aspect-[3/2] w-full bg-neutral-100 dark:bg-neutral-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.thumb ?? m.url} alt={m.filename} className="h-full w-full object-cover" />
            </button>
            <figcaption className="space-y-1 p-2 text-xs">
              <p className="truncate font-medium text-neutral-700 dark:text-neutral-300" title={m.filename}>
                {m.filename}
              </p>
              <p className="text-neutral-400">
                {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
                {formatBytes(m.size)} · {formatDateVi(m.uploadedAt)}
              </p>
              {mode === 'page' && (
                <div className="flex flex-wrap gap-3 pt-1">
                  <button onClick={() => copyUrl(m.url)} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                    {t.copyUrl}
                  </button>
                  <a href={m.url} download={m.filename} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                    {t.downloadOriginal}
                  </a>
                  <button onClick={() => handleDelete(m.url)} className="text-red-600 hover:text-red-700">
                    {t.delete}
                  </button>
                </div>
              )}
            </figcaption>
          </figure>
        ))}
      </div>
      {visible < items.length && <div ref={sentinel} className="h-10" />}
    </>
  )

  const body = (
    <div className="space-y-5">
      <ImageUploader onUploaded={(uploaded) => setItems((prev) => [...uploaded, ...prev])} />
      {loading ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.loading}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.noMedia}</p>
      ) : (
        grid
      )}
    </div>
  )

  // Full-size zoom overlay (page mode).
  const lightbox = zoom && (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 p-4"
      onClick={() => setZoom(null)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={zoom.url}
        alt={zoom.filename}
        className="max-h-[85vh] max-w-full rounded-lg object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      <p className="mt-3 text-sm text-white/80">
        {zoom.filename}
        {zoom.width && zoom.height ? ` · ${zoom.width}×${zoom.height}` : ''} · {formatBytes(zoom.size)}
      </p>
    </div>
  )

  if (mode === 'page') {
    return (
      <>
        {body}
        {lightbox}
      </>
    )
  }

  // Picker modal.
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-3xl flex-col rounded-2xl bg-white p-5 dark:bg-neutral-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t.mediaTitle}</h2>
          <Button variant="ghost" onClick={onClose}>
            {t.close}
          </Button>
        </div>
        <div className="overflow-y-auto">{body}</div>
      </div>
    </div>
  )
}
