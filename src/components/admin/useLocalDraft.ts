'use client'

// Local (offline) autosave for the editor. A SERVER autosave is the wrong tool
// here: it can't help when the network is the thing that dropped, and on an
// already-published post it would push half-finished edits live. So in-progress
// work is stashed in localStorage and only ever reaches the server when the
// author clicks Save/Publish. On return, if a snapshot lingers (the last session
// closed/crashed with unsaved changes), the form offers to restore it.
import { useCallback, useEffect, useState } from 'react'

export type LocalSnapshot<T> = { data: T; at: string }

export function useLocalDraft<T>(key: string) {
  const [recovered, setRecovered] = useState<LocalSnapshot<T> | null>(null)

  // Read any lingering snapshot once on mount. A snapshot only survives if the
  // previous session ended without a successful server save (which clears it).
  // The setState is deferred to a frame so it lands after hydration (the bar is
  // never in the server HTML) and isn't a synchronous in-effect update.
  useEffect(() => {
    let raf = 0
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const snap = JSON.parse(raw) as LocalSnapshot<T>
        raf = requestAnimationFrame(() => setRecovered(snap))
      }
    } catch {
      // ignore corrupt/blocked storage — local autosave is best-effort
    }
    return () => {
      if (raf) cancelAnimationFrame(raf)
    }
  }, [key])

  const save = useCallback(
    (data: T) => {
      try {
        localStorage.setItem(key, JSON.stringify({ data, at: new Date().toISOString() }))
      } catch {
        // storage full / disabled — nothing we can do, don't break the editor
      }
    },
    [key],
  )

  // Drop the snapshot AND hide the bar (after a server save or an explicit restore).
  const clear = useCallback(() => {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore
    }
    setRecovered(null)
  }, [key])

  // Hide the bar but keep the snapshot (the author dismissed it without restoring).
  const dismiss = useCallback(() => setRecovered(null), [])

  return { recovered, save, clear, dismiss }
}
