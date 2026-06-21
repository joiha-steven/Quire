'use client'

// Tiny analytics beacon. Fires one /api/track POST per public page view (and on
// every client-side navigation, via usePathname). Uses sendBeacon when available
// so it never blocks; falls back to a keepalive fetch. Purely client-side, so it
// does not make any page dynamic. No-op for admin paths (defence in depth).
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function Track() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return
    const body = JSON.stringify({ path: pathname })
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
      } else {
        fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
      }
    } catch {
      /* ignore */
    }
  }, [pathname])
  return null
}
