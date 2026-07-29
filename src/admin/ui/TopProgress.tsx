// The thin bar across the top of the admin, shown while a page is being fetched.
//
// It exists because navigation stopped replacing the screen. The old page now stays put
// until the new one is ready, which is the right behaviour and also removes the only signal
// the admin had that a click did anything at all. The bar is that signal.
//
// It is deliberately NOT a percentage. Nothing here knows how far along a fetch is, and a
// bar that claims 60% and then sits there is worse than one that visibly keeps moving: the
// animation eases toward the right edge and never arrives, then snaps to full and fades the
// moment the work finishes.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { getInFlight, subscribeInFlight } from '@/admin/pending'
import { useRouter } from '@/admin/router'

/** How long the finished bar stays on screen. Matches the fade in `admin.css`. */
const EXIT_MS = 320

export function TopProgress() {
  const { pending } = useRouter()
  const inFlight = useSyncExternalStore(subscribeInFlight, getInFlight, () => 0)
  const busy = pending || inFlight > 0

  // `visible` lags `busy` on the way down, so the bar can play its exit rather than
  // disappearing mid-stride. `run` is what restarts the animation: keying the element on it
  // gives React a different element each time, and a fresh element replays its animation.
  const [visible, setVisible] = useState(false)
  const [run, setRun] = useState(0)

  // `visible` is deliberately not a dependency: it changes when the exit timer fires, and
  // depending on it would restart the timer that just ran.
  useEffect(() => {
    if (busy) {
      setVisible(true)
      setRun((n) => n + 1)
      return undefined
    }
    const timer = setTimeout(() => setVisible(false), EXIT_MS)
    return () => clearTimeout(timer)
  }, [busy])

  if (!visible) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 overflow-hidden" aria-hidden="true">
      <div
        key={run}
        data-done={busy ? undefined : 'true'}
        className="quire-progress-bar h-full w-full bg-neutral-900 dark:bg-neutral-100"
      />
    </div>
  )
}
