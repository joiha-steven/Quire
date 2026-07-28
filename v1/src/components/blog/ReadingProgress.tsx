'use client'

// A thin progress bar fixed at the top of the viewport that fills as the reader
// scrolls through the page. Passive scroll listener; no layout cost.
import { useEffect, useState } from 'react'

export function ReadingProgress() {
  const [pct, setPct] = useState(0)

  useEffect(() => {
    const onScroll = () => {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setPct(max > 0 ? Math.min(100, (h.scrollTop / max) * 100) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 bg-transparent">
      <div className="h-full bg-heading transition-[width] duration-75" style={{ width: `${pct}%` }} />
    </div>
  )
}
