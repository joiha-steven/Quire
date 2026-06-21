'use client'

// Tracks how far down the page a reader got, and sends that max % once when they
// leave (tab hidden / pagehide / client-nav away). Backs the "average read depth"
// metric. Beacon-based, fire-and-forget; the owner's own samples are dropped in
// /api/track. Mounted only on post pages.
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

function currentDepth(): number {
  const doc = document.documentElement
  const scrollable = doc.scrollHeight - doc.clientHeight
  if (scrollable <= 0) return 100 // page fits the viewport → fully seen
  return Math.max(0, Math.min(100, Math.round(((window.scrollY) / scrollable) * 100)))
}

export function ScrollDepth() {
  const pathname = usePathname()
  useEffect(() => {
    if (!pathname) return
    let max = currentDepth()
    let sent = false

    const onScroll = () => {
      const d = currentDepth()
      if (d > max) max = d
    }
    const send = () => {
      if (sent || max <= 0) return
      sent = true
      const body = JSON.stringify({ path: pathname, depth: max })
      try {
        if (navigator.sendBeacon) navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }))
        else fetch('/api/track', { method: 'POST', body, headers: { 'Content-Type': 'application/json' }, keepalive: true })
      } catch {
        /* ignore */
      }
    }
    const onHide = () => document.visibilityState === 'hidden' && send()

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', send)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', send)
      document.removeEventListener('visibilitychange', onHide)
      send() // client-side navigation away from this post
    }
  }, [pathname])
  return null
}
