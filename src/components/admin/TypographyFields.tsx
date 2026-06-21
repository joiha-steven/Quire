'use client'

// Heading-size editor. Five numeric inputs (rem) drive the site type scale
// (--fs-h1..--fs-h5); a single "reset" restores the built-in defaults. Parent owns
// the state + save (one form, one save button). A live preview reflects edits.
import type { TypographySettings } from '@/types'
import { DEFAULT_TYPOGRAPHY } from '@/lib/themes'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/lib/admin-i18n'

type LevelKey = keyof TypographySettings

const FIELDS: { key: LevelKey; label: keyof AdminStrings }[] = [
  { key: 'h1', label: 'typoH1' },
  { key: 'h2', label: 'typoH2' },
  { key: 'h3', label: 'typoH3' },
  { key: 'h4', label: 'typoH4' },
  { key: 'h5', label: 'typoH5' },
]

function SizeRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={0.5}
          max={6}
          step={0.01}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-right font-mono text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <span className="text-xs text-neutral-400 dark:text-neutral-500">rem</span>
      </span>
    </label>
  )
}

type Props = {
  typography: TypographySettings
  onChange: (typography: TypographySettings) => void
}

export function TypographyFields({ typography, onChange }: Props) {
  const t = useAdminT()
  const set = (key: LevelKey, value: number) =>
    onChange({ ...typography, [key]: Number.isFinite(value) ? value : typography[key] })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.typographyHint}</p>
        <button
          type="button"
          onClick={() => onChange({ ...DEFAULT_TYPOGRAPHY })}
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          {t.resetDefault}
        </button>
      </div>

      <div className="space-y-3">
        {FIELDS.map((f) => (
          <SizeRow key={f.key} label={t[f.label] as string} value={typography[f.key]} onChange={(v) => set(f.key, v)} />
        ))}
      </div>

      {/* Live preview: each line uses the matching --fs var so edits show at a glance.
          Inline style keeps it independent of the page's injected scale. */}
      <div className="space-y-1.5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        {FIELDS.map((f) => (
          <p
            key={f.key}
            className="truncate font-semibold tracking-tight text-neutral-900 dark:text-white"
            style={{ fontSize: `${typography[f.key]}rem`, lineHeight: 1.2 }}
          >
            {f.key.toUpperCase()} · {t.typographyPreview}
          </p>
        ))}
        <p className="text-[1.125rem] text-neutral-500 dark:text-neutral-400">{t.typographyPreviewBody}</p>
      </div>
    </div>
  )
}
