'use client'

// Theme button + dropdown: Light / Dark / System / By time.
import { useState, useSyncExternalStore } from 'react'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { ICON_BTN } from '@/components/ui/iconButton'
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

function ContrastIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5a7 7 0 0 0 0 14Z" fill="currentColor" stroke="none" />
    </svg>
  )
}

// `variant` picks the trigger: 'icon' (public header — contrast) or 'text'
// (admin header — the applied theme as a word, styled like the nav links via
// `triggerClassName`). The dropdown is identical in both.
export function ThemeToggle({
  lang,
  variant = 'icon',
  triggerClassName = '',
}: {
  lang: SiteLang
  variant?: 'icon' | 'text'
  triggerClassName?: string
}) {
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
        className={variant === 'text' ? triggerClassName : ICON_BTN}
      >
        {variant === 'text' ? (isDark ? s.themeDark : s.themeLight) : <ContrastIcon />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className={`absolute z-50 w-44 overflow-hidden border py-1 shadow-lg ${variant === 'text' ? 'bottom-0 left-full ml-2 border-neutral-200 bg-white dark:border-neutral-700 dark:bg-neutral-900' : 'right-0 mt-2 border-rule bg-bg'}`}>
            {items.map((it) => (
              <button
                key={it.key}
                type="button"
                onClick={() => {
                  setMode(it.key)
                  setOpen(false)
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left t-small ${variant === 'text' ? 'hover:bg-neutral-100 dark:hover:bg-neutral-800' : 'hover:bg-rule'} ${
                  mode === it.key
                    ? variant === 'text' ? 'font-semibold text-neutral-900 dark:text-white' : 'font-semibold text-heading'
                    : variant === 'text' ? 'text-neutral-500 dark:text-neutral-400' : 'text-meta'
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
