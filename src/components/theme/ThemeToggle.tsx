'use client'

// Theme button + dropdown: Light / Dark / System / By time.
import { useState, useSyncExternalStore } from 'react'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { useTheme, type ThemeMode } from './ThemeProvider'

// Reflect the actually-applied theme by reading the <html> `dark` class (set by
// the no-FOUC script + ThemeProvider). useSyncExternalStore gives a stable server
// snapshot (light) so hydration matches, then tracks the real class on the client
// — re-rendering whenever the class flips (mode change, OS change, clock).
function subscribe(cb: () => void): () => void {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}
function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains('dark'),
    () => false,
  )
}

const ICON = 'h-5 w-5'
const STROKE = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} {...STROKE} aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" className={ICON} {...STROKE} aria-hidden>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

export function ThemeToggle({ lang }: { lang: SiteLang }) {
  const { mode, setMode } = useTheme()
  const [open, setOpen] = useState(false)
  const isDark = useIsDark()
  const s = t(lang)

  const items: { key: ThemeMode; label: string }[] = [
    { key: 'light', label: s.themeLight },
    { key: 'dark', label: s.themeDark },
    { key: 'system', label: s.themeSystem },
    { key: 'time', label: s.themeTime },
  ]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={s.theme}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        {isDark ? <MoonIcon /> : <SunIcon />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => {
                  setMode(it.key)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800 ${
                  mode === it.key ? 'font-semibold text-neutral-900 dark:text-white' : 'text-neutral-600 dark:text-neutral-300'
                }`}
              >
                {it.label}
                {mode === it.key && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
