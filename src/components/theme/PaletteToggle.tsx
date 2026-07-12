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

// Wide preview chip: the palette's background with its basic colors (heading,
// body, link, meta) as little bars — enough to recognize the palette at a glance.
function Swatch({ c }: { c: ThemeColors }) {
  return (
    <span
      className="flex h-6 w-11 shrink-0 items-center gap-1 rounded-md px-1.5"
      style={{ background: c.bg, boxShadow: `inset 0 0 0 1px ${c.rule}` }}
      aria-hidden
    >
      {[c.heading, c.text, c.link, c.meta].map((color, i) => (
        <span key={i} className="h-3 w-1.5 rounded-full" style={{ background: color }} />
      ))}
    </span>
  )
}

// Four quiet tones: a compact palette mark that stays legible at header size.
function PaletteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
      <circle cx="8" cy="8" r="2.25" />
      <circle cx="16" cy="8" r="2.25" opacity=".72" />
      <circle cx="8" cy="16" r="2.25" opacity=".48" />
      <circle cx="16" cy="16" r="2.25" opacity=".24" />
    </svg>
  )
}

// `variant`: 'icon' (public header) or 'text' (admin header). The text variant
// shows `label` (a fixed word like "Appearance") when given, else the current
// palette name; styled like the nav links via `triggerClassName`.
export function PaletteToggle({
  lang,
  palettes,
  defaultId,
  variant = 'icon',
  triggerClassName = '',
  label,
}: {
  lang: SiteLang
  palettes: PaletteOption[]
  defaultId: string
  variant?: 'icon' | 'text'
  triggerClassName?: string
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const current = useCurrentPalette(defaultId)
  const s = t(lang)
  const nameOf = (p: PaletteOption) => s.paletteNames[p.id] ?? p.name
  const currentName = palettes.find((p) => p.id === current)
  const triggerText = label ?? (currentName ? nameOf(currentName) : s.palette)

  // Nothing to switch between: hide the control entirely (owner enabled ≤1 palette).
  if (palettes.length <= 1) return null

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={s.palette}
        title={s.palette}
        className={variant === 'text' ? triggerClassName : ICON_BTN}
      >
        {variant === 'text' ? triggerText : <PaletteIcon />}
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-rule bg-bg py-1 shadow-lg">
            {palettes.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  apply(p.id)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left t-small hover:bg-rule ${
                  current === p.id ? 'font-semibold text-heading' : 'text-meta'
                }`}
              >
                <Swatch c={p.light} />
                <span className="flex-1">{nameOf(p)}</span>
                {current === p.id && <span aria-hidden>✓</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
