'use client'

// Palette switcher: lets any visitor pick one of the built-in color palettes,
// independent of light/dark mode. The choice is stored in localStorage and
// applied as `<html data-palette="id">` (the layout emits every palette's CSS
// vars, so switching is instant with no server round-trip). A no-FOUC script in
// the root layout applies the stored palette before paint.
import { useState, useSyncExternalStore } from 'react'
import type { SiteLang, ThemeColors } from '@/types'
import { t } from '@/lib/i18n'
import { ICON_BTN } from '@/components/ui/iconButton'

export type PaletteOption = { id: string; name: string; light: ThemeColors }

const STORAGE_KEY = 'palette'

function apply(id: string): void {
  document.documentElement.setAttribute('data-palette', id)
  localStorage.setItem(STORAGE_KEY, id)
}

// Track the applied palette by reading `<html data-palette>` (set by the no-FOUC
// script + apply()). Server snapshot = the owner default, so SSR and first client
// render agree; then it tracks the real attribute, re-rendering on every change.
function subscribe(cb: () => void): () => void {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-palette'] })
  return () => obs.disconnect()
}
function useCurrentPalette(defaultId: string): string {
  return useSyncExternalStore(
    subscribe,
    () => document.documentElement.getAttribute('data-palette') || defaultId,
    () => defaultId,
  )
}

// Tiny preview: the palette's light background with a heading + link bar.
function Swatch({ c }: { c: ThemeColors }) {
  return (
    <span
      className="flex h-5 w-5 shrink-0 items-center justify-center gap-px rounded-md border"
      style={{ background: c.bg, borderColor: c.rule }}
      aria-hidden
    >
      <span className="h-2.5 w-1 rounded-full" style={{ background: c.heading }} />
      <span className="h-2.5 w-1 rounded-full" style={{ background: c.link }} />
    </span>
  )
}

function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-1 1.4-2-.4-1 .2-2 1.3-2H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" />
      <circle cx="7.5" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  )
}

// `variant`: 'icon' (public header) or 'text' (admin header — shows the current
// palette name, styled like the nav links via `triggerClassName`).
export function PaletteToggle({
  lang,
  palettes,
  defaultId,
  variant = 'icon',
  triggerClassName = '',
}: {
  lang: SiteLang
  palettes: PaletteOption[]
  defaultId: string
  variant?: 'icon' | 'text'
  triggerClassName?: string
}) {
  const [open, setOpen] = useState(false)
  const current = useCurrentPalette(defaultId)
  const s = t(lang)
  const currentName = palettes.find((p) => p.id === current)?.name ?? ''

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={s.palette}
        title={s.palette}
        className={variant === 'text' ? triggerClassName : ICON_BTN}
      >
        {variant === 'text' ? currentName || s.palette : <PaletteIcon />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-rule bg-bg py-1 shadow-lg">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  apply(p.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-rule ${
                  current === p.id ? 'font-semibold text-heading' : 'text-meta'
                }`}
              >
                <Swatch c={p.light} />
                <span className="flex-1">{p.name}</span>
                {current === p.id && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
