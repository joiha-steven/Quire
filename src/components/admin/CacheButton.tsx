'use client'

// Header button: purge all caches, then hard-reload so the owner immediately
// sees fresh data everywhere.
import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

export function CacheButton() {
  const t = useAdminT()
  const { notify } = useToast()
  const [busy, setBusy] = useState(false)

  async function clear() {
    setBusy(true)
    try {
      const res = await fetch('/api/cache/clear', { method: 'POST' })
      if (!res.ok) throw new Error()
      notify(t.cacheCleared)
      // Full reload (not router.refresh) so every server component re-renders.
      window.location.reload()
    } catch {
      notify(t.clearCacheFailed, 'error')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={clear}
      disabled={busy}
      className="text-sm text-neutral-500 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-400 dark:hover:text-white"
    >
      {t.clearCache}
    </button>
  )
}
