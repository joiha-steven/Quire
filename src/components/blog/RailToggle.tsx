'use client'

// The mobile opener for the sidebar drawer (the sidebar now carries the site menu at
// its top). Lives in the header; above the rail breakpoint the layout hides it (`.rail-
// toggle`) because the sidebar is then the always-visible gutter rail. Open state lives on
// <html data-rail>, so the drawer + scrim react in pure CSS — nothing else re-renders.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'

// Whether the current page rendered a rail. Read from the DOM via useSyncExternalStore
// (server snapshot = true, so SSR/first paint shows the button; the client snapshot re-
// reads on every render — usePathname re-renders on navigation — so it self-corrects per
// route). A no-op subscribe: rail presence only changes on navigation, which re-renders.
const noopSubscribe = () => () => {}
function useHasRail(): boolean {
  return useSyncExternalStore(noopSubscribe, () => !!document.querySelector('.rail'), () => true)
}
import { t } from '@/lib/i18n'
import type { SiteLang } from '@/types'
import { ICON_BTN } from '@/components/ui/iconButton'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 8h14M8 16h11" />
    </svg>
  )
}

export function RailToggle({ lang }: { lang: SiteLang }) {
  const pathname = usePathname()
  // Openness is remembered per route, so following a link inside the drawer lands on the
  // next page with it shut — no effect, no cascading render.
  const [openFor, setOpenFor] = useState<string | null>(null)
  const open = openFor === pathname
  const setOpen = (v: boolean) => setOpenFor(v ? pathname : null)

  // Self-hide when this page has no rail (a post with no ToC, /search, 404): the button
  // would otherwise open nothing.
  const hasRail = useHasRail()

  useEffect(() => {
    document.documentElement.dataset.rail = open ? 'open' : 'closed'
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenFor(null)
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [open])

  if (!hasRail) return null
  return (
    <>
      {open && <div className="rail-scrim" onClick={() => setOpen(false)} />}
      <button
        type="button"
        className={`rail-toggle ${ICON_BTN}`}
        aria-label={t(lang).menu}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <MenuIcon />
      </button>
    </>
  )
}
