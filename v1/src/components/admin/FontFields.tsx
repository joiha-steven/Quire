'use client'

// Two font pickers. The TOP grid sets `fontPreset` (the reading font: article body,
// title, comments, editor) AND drops that font's tuned typography into the editable
// roles below — a serif runs small and wants a tighter leading than a sans, so the
// reading setup travels with the font. An uploaded custom font (below) overrides it.
// The BOTTOM row sets `chromeFont` (the system-chrome font: header/footer/rail/meta/
// admin) INDEPENDENTLY — pick a code font here while the body stays readable.
import type { TypographySettings } from '@/types'
import { FONT_PRESETS, CHROME_FONTS } from '@/lib/themes'
import { useAdminT } from './I18nProvider'

export function FontFields({
  value,
  onChange,
  chromeFont,
  onChromeFont,
}: {
  value: string
  onChange: (fontPreset: string, typography: TypographySettings) => void
  chromeFont: string
  onChromeFont: (v: string) => void
}) {
  const t = useAdminT()
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2">
        {FONT_PRESETS.map((f) => {
          const active = f.id === value
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id, f.typography)}
              aria-pressed={active}
              className={`border px-3 py-2 text-left transition-colors ${
                active
                  ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                  : 'border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300'
              }`}
              style={{ fontFamily: f.stack }}
            >
              <span className="block text-base leading-tight">{f.name}</span>
              <span className={`block text-xs ${active ? 'opacity-70' : 'text-neutral-400 dark:text-neutral-500'}`}>
                Aa · 1793
              </span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.fontPresetHint}</p>
      <div className="border-t border-neutral-200 pt-3 dark:border-neutral-800">
        <p className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.chromeFontLabel}</p>
        <div className="grid grid-cols-3 gap-2">
          {CHROME_FONTS.map((f) => {
            const active = f.id === chromeFont
            const label = f.id === 'reading' ? t.chromeFontReading : f.name
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChromeFont(f.id)}
                aria-pressed={active}
                className={`border px-2 py-2 text-center text-sm transition-colors ${
                  active
                    ? 'border-neutral-900 bg-neutral-900 text-white dark:border-white dark:bg-white dark:text-neutral-900'
                    : 'border-neutral-300 text-neutral-700 hover:border-neutral-500 dark:border-neutral-700 dark:text-neutral-300'
                }`}
                style={{ fontFamily: f.sans ?? `'Inter'` }}
              >
                {label}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-neutral-400 dark:text-neutral-500">{t.chromeFontHint}</p>
      </div>
    </div>
  )
}
