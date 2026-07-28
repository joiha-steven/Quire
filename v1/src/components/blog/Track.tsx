'use client'

// Tiny analytics beacon. Fires one /api/track POST per public page view (and on
// every client-side navigation, via usePathname). Uses sendBeacon when available
// so it never blocks; falls back to a keepalive fetch. Purely client-side, so it
// does not make any page dynamic. No-op for admin paths (defence in depth).
// Held back until the document is actually viewed, so a prerendered page the
// reader never opens is never counted (see lib/prerender.ts).
import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { whenActivated } from '@/lib/prerender'

export function Track() {
  const pathname = usePathname()
  // Referrer is only meaningful on session ENTRY — document.referrer doesn't
  // change across client navigations, so send it once (first view) to avoid
  // attributing every in-app pageview to the same external source.
  const sentReferrer = useRef(false)
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    return whenActivated(() => {
      let referrer = ''
      if (!sentReferrer.current) {
        sentReferrer.current = true
        try {
          const r = document.referrer
          if (r) {
            const host = new URL(r).host
            if (host && host !== location.host) referrer = host // external sources only
          }
        } catch {
          /* malformed referrer — ignore */
        }
      }
      const body = JSON.stringify({ path: pathname, referrer })
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
        } else {
          fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
        }
      } catch {
        /* ignore */
      }
    })
  }, [pathname])
  return null
}
