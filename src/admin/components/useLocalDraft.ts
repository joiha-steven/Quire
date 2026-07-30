// Local (offline) autosave for the editor. A SERVER autosave is the wrong tool
// here: it can't help when the network is the thing that dropped, and on an
// already-published post it would push half-finished edits live. So in-progress
// work is stashed in localStorage and only ever reaches the server when the
// author clicks Save/Publish. On return, if a snapshot lingers (the last session
// closed/crashed with unsaved changes), the form offers to restore it.
import { useCallback, useEffect, useRef, useState } from 'react'

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

/** How often an untouched editor writes a snapshot. The floor, not the guarantee. */
const AUTOSAVE_MS = 8_000

/**
 * Keep the local snapshot current while the author works, and flush it on the way out.
 *
 * The interval alone was losing work, and the case was specific: on a phone, an over-scroll
 * at the top of the editor triggers the browser's pull-to-refresh and the page RELOADS, taking
 * everything typed since the last tick. `beforeunload` does not reliably fire there, so the
 * events that matter are `pagehide` and a `visibilitychange` to hidden. The unmount flush
 * covers leaving the editor by a route the admin's own router controls.
 *
 * `isDirty` and `snapshot` are read through refs so a caller can pass plain arrows without
 * re-arming the interval on every keystroke.
 */
export function useLocalAutosave<T>(
  isDirty: () => boolean,
  snapshot: () => T,
  save: (data: T) => void,
): void {
  const isDirtyRef = useRef(isDirty)
  const snapshotRef = useRef(snapshot)
  isDirtyRef.current = isDirty
  snapshotRef.current = snapshot

  useEffect(() => {
    const flush = () => {
      if (isDirtyRef.current()) save(snapshotRef.current())
    }
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    const id = setInterval(flush, AUTOSAVE_MS)
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onHidden)
    return () => {
      clearInterval(id)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onHidden)
      flush()
    }
  }, [save])
}

/**
 * Ask before leaving with unsaved changes.
 *
 * A browser only honours this when the reader has interacted with the page, and never for a
 * pull-to-refresh, which is why the snapshot above is the real safety net and this is the
 * courtesy on top of it.
 */
export function useUnsavedGuard(isDirty: () => boolean): void {
  const isDirtyRef = useRef(isDirty)
  isDirtyRef.current = isDirty

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!isDirtyRef.current()) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])
}
