'use client'

// Header button: purge the whole public cache and warm it again. Public pages
// are ISR-cached and also auto-purge on save; this is the manual "refresh
// everything now" escape hatch (e.g. after editing content directly in Blob).
import { useState } from 'react'
import type { ApiResponse } from '@/types'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

export function CacheButton() {
  const t = useAdminT()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  async function clear() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' })
      const json = (await res.json()) as ApiResponse<{ warmed: number }>
      if (!json.success) throw new Error(json.error)
      notify(t.cacheCleared)
    } catch {
      notify(t.clearCacheFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={clear}
      disabled={busy}
      className="flex h-10 items-center rounded-lg px-3 text-neutral-600 hover:bg-neutral-100 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      {busy ? `${t.clearCache}…` : t.clearCache}
    </button>
  )
}
