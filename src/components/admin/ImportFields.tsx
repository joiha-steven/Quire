'use client'

// WordPress import (Admin → Settings → Integrations). Uploads a WXR .xml export to
// /api/import/wordpress, which converts posts + pages to Markdown and adds them
// (slug collisions get a numeric suffix; nothing is overwritten). Images keep their
// source URLs. Owner-only via the route's requireOwner().
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ApiResponse } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

type ImportResult = { posts: number; pages: number; skipped: number }

export function ImportFields() {
  const t = useAdminT()
  const router = useRouter()
  const { notify } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  async function run() {
    if (!file) return
    setBusy(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/import/wordpress', { method: 'POST', body })
      const json = (await res.json()) as ApiResponse<ImportResult>
      if (!json.success || !json.data) throw new Error(json.error)
      const d = json.data
      notify(`${t.importDone}: ${d.posts} + ${d.pages}`)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
      router.refresh() // surface the new posts/pages in the admin lists at once
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-neutral-500 dark:text-neutral-400">{t.importHelp}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-neutral-600 file:mr-3 file:border file:border-neutral-300 file:bg-neutral-50 file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-neutral-100 dark:text-neutral-400 dark:file:border-neutral-700 dark:file:bg-neutral-900"
        aria-label={t.importChoose}
      />
      <button
        type="button"
        onClick={run}
        disabled={busy || !file}
        className="bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {busy ? `${t.importRun}…` : t.importRun}
      </button>
    </div>
  )
}
