'use client'

// Theme button + dropdown: Light / Dark / System / By time.
import { useState } from 'react'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { useTheme, type ThemeMode } from './ThemeProvider'

// Half-filled circle (contrast) icon for the trigger.
function ContrastIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" />
    </svg>
  )
}

export function ThemeToggle({ lang }: { lang: SiteLang }) {
  const { mode, setMode } = useTheme()
  const [open, setOpen] = useState(false)
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
        className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        <ContrastIcon />
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
