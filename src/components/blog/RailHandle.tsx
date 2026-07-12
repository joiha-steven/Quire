'use client'

// Below the rail breakpoint the rail is a drawer; this is its edge handle. Open
// state lives on <html data-rail>, so the drawer, the handle and the scrim all
// react in CSS and nothing re-renders. Above the breakpoint the layout's injected
// media query hides the handle and the scrim, and the attribute means nothing.
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

export function RailHandle({ label }: { label: string }) {
  const pathname = usePathname()
  // Openness is remembered per route, so following a link inside the drawer
  // lands on the next page with it shut — no effect, no cascading render.
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === pathname
  const setOpen = (v: boolean) => setOpenFor(v ? pathname : null)

  useEffect(() => {
    document.documentElement.dataset.rail = open ? 'open' : 'closed'
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenFor(null)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {open && <div className="rail-scrim" onClick={() => setOpen(false)} />}
      <button
        type="button"
        className="rail-handle"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <svg width="14" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </>
  )
}
