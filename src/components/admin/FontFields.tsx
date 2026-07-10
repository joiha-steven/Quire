'use client'

// Built-in font picker. Choosing a font sets `fontPreset` AND drops that font's
// tuned typography into the editable roles below — a serif runs small and wants a
// tighter leading than a sans, so the reading setup travels with the font. The
// owner still owns and can adjust every value afterwards. An uploaded custom font
// (below) overrides whichever built-in is chosen.
import type { TypographySettings } from '@/types'
import { FONT_PRESETS } from '@/lib/themes'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

export function FontFields({
  value,
  onChange,
  chromeInter,
  onChromeInter,
}: {
  value: string
  onChange: (fontPreset: string, typography: TypographySettings) => void
  chromeInter: boolean
  onChromeInter: (v: boolean) => void
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
        <ToggleRow
          label={t.fontChromeInter}
          desc={t.fontChromeInterDesc}
          checked={chromeInter}
          onChange={onChromeInter}
        />
      </div>
    </div>
  )
}
