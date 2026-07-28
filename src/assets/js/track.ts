// The analytics beacon: one page view on load, one scroll-depth sample on leave.
//
// Both are held back by `whenActivated`. A prerendered page runs its scripts at
// speculation time, so without that guard a hover would record a view for a page the
// reader never opened, and the dwell timer would count the wait as reading time.

import { whenActivated } from './activation'

/** `sendBeacon` when it exists, a keepalive fetch when it does not. Never blocks. */
function beacon(payload: Record<string, unknown>): void {
  const body = JSON.stringify(payload)
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
    } else {
      fetch('/api/track', {
        method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true,
      })
    }
  } catch {
    /* analytics must never affect the page */
  }
}

/** The referrer host, but only when it is another site. '' otherwise. */
function externalReferrer(): string {
  try {
    const r = document.referrer
    if (!r) return ''
    const host = new URL(r).host
    return host && host !== location.host ? host : ''
  } catch {
    return '' // malformed referrer
  }
}

/** How far down the page the reader has got, as a percentage. */
function depth(): number {
  const doc = document.documentElement
  const scrollable = doc.scrollHeight - doc.clientHeight
  if (scrollable <= 0) return 100 // the page fits the viewport, so it was fully seen
  return Math.max(0, Math.min(100, Math.round((scrollY / scrollable) * 100)))
}

export function track(): void {
  const path = location.pathname
  // Defence in depth. The server drops these paths too, but there is no reason to send them.
  if (path.startsWith('/admin') || path.startsWith('/api')) return

  whenActivated(() => {
    beacon({ path, referrer: externalReferrer() })

    // The depth sample is sent ONCE, when the reader leaves. `pagehide` and a hidden tab
    // both count as leaving, and either can be the last event a browser delivers, so both
    // are wired and `sent` makes the second one a no-op.
    let max = depth()
    let sent = false
    const start = performance.now()
    const send = () => {
      if (sent || max <= 0) return
      sent = true
      beacon({ path, depth: max, dwell: Math.round(performance.now() - start) })
    }

    addEventListener('scroll', () => { max = Math.max(max, depth()) }, { passive: true })
    addEventListener('pagehide', send)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') send()
    })
  })
}
