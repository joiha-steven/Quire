'use client'

// Header toggle that switches a listing (home / category / tag) between the default
// stacked LIST and a card GRID. The choice lives on <html data-list> (grid) + localStorage,
// so the layout reacts in pure CSS (globals.css + rail-css.ts) with no re-render, and the
// no-FOUC script (root layout) applies it before paint. Self-hides on any page with no
// post list (a reading view, /search, 404) — mirrors RailToggle.
import { useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { t } from '@/lib/i18n'
import type { SiteLang } from '@/types'
import { ICON_BTN } from '@/components/ui/iconButton'

// Present only where a post list rendered. Server snapshot = true (SSR shows the button);
// the client snapshot re-reads on every render, and usePathname re-renders on navigation.
const noopSubscribe = () => () => {}
function useHasList(): boolean {
  return useSyncExternalStore(noopSubscribe, () => !!document.querySelector('.post-list'), () => true)
}

// Track the applied mode by watching <html data-list> (set by the no-FOUC script + this
// toggle), so the icon/label always reflects the real state — like ThemeToggle's dark read.
function subscribe(cb: () => void): () => void {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-list'] })
  return () => obs.disconnect()
}
function useIsGrid(): boolean {
  return useSyncExternalStore(subscribe, () => document.documentElement.dataset.list === 'grid', () => false)
}

function GridIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="4" width="7" height="7" /><rect x="13" y="4" width="7" height="7" /><rect x="4" y="13" width="7" height="7" /><rect x="13" y="13" width="7" height="7" />
    </svg>
  )
}
function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function GridToggle({ lang }: { lang: SiteLang }) {
  usePathname() // re-evaluate list presence on navigation
  const hasList = useHasList()
  const isGrid = useIsGrid()
  const s = t(lang)
  if (!hasList) return null
  const toggle = () => {
    const next = isGrid ? 'list' : 'grid'
    document.documentElement.dataset.list = next
    try {
      localStorage.setItem('list', next)
    } catch {}
  }
  return (
    <button
      type="button"
      className={ICON_BTN}
      aria-label={isGrid ? s.listView : s.gridView}
      aria-pressed={isGrid}
      onClick={toggle}
    >
      {isGrid ? <ListIcon /> : <GridIcon />}
    </button>
  )
}
