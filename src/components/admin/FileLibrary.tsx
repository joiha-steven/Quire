'use client'

// Files tab: a list of non-image attachments (PDF, zip, docx, audio…). Upload,
// copy URL, download, delete. Plain rows (no thumbnails — these aren't images).
import { useEffect, useState } from 'react'
import type { FileItem, ApiResponse } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { formatBytes, formatDateVi } from '@/lib/utils'
import { FileUploader } from './FileUploader'
import { useAdminT } from './I18nProvider'

// Short uppercase tag from the filename extension (or the MIME subtype).
function ext(item: FileItem): string {
  const dot = item.filename.lastIndexOf('.')
  if (dot >= 0 && dot < item.filename.length - 1) return item.filename.slice(dot + 1).toUpperCase()
  const sub = item.contentType.split('/')[1]
  return (sub || 'FILE').toUpperCase().slice(0, 5)
}

export function FileLibrary() {
  const t = useAdminT()
  const { notify } = useToast()
  const [items, setItems] = useState<FileItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/files')
      .then((r) => r.json() as Promise<ApiResponse<FileItem[]>>)
      .then((j) => setItems(j.data ?? []))
      .catch(() => notify(t.loadFilesFailed, 'error'))
      .finally(() => setLoading(false))
  }, [notify, t])

  async function handleDelete(url: string) {
    if (!confirm(t.confirmDeleteFile)) return
    try {
      const res = await fetch(`/api/files/by?url=${encodeURIComponent(url)}`, { method: 'DELETE' })
      const json = (await res.json()) as ApiResponse<FileItem[]>
      if (!json.success) throw new Error(json.error)
      if (json.data) setItems(json.data) // adopt server's authoritative list
      notify(t.deleted)
    } catch {
      notify(t.deleteFailed, 'error')
    }
  }

  async function copyUrl(url: string) {
    await navigator.clipboard.writeText(url)
    notify(t.copiedUrl)
  }

  return (
    <div className="space-y-5">
      <FileUploader onUploaded={(uploaded) => setItems((prev) => [...uploaded, ...prev])} />
      {loading ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.loading}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-neutral-400 dark:text-neutral-500">{t.noFiles}</p>
      ) : (
        <ul className="divide-y divide-neutral-200 overflow-hidden rounded-lg border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
          {items.map((f) => (
            <li key={f.url} className="flex items-center gap-3 bg-white p-3 dark:bg-neutral-900">
              <span className="flex h-9 w-12 shrink-0 items-center justify-center rounded bg-neutral-100 text-[10px] font-bold text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400">
                {ext(f)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-neutral-800 dark:text-neutral-200" title={f.filename}>
                  {f.filename}
                </p>
                <p className="text-xs text-neutral-400">
                  {formatBytes(f.size)} · {formatDateVi(f.uploadedAt)}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-3 text-xs">
                <button onClick={() => copyUrl(f.url)} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                  {t.copyUrl}
                </button>
                <a href={f.url} download={f.filename} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                  {t.download}
                </a>
                <button onClick={() => handleDelete(f.url)} className="text-red-600 hover:text-red-700">
                  {t.delete}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
