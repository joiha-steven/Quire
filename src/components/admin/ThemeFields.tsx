'use client'

// Controlled per-mode reading colors (light + dark). Parent owns state + save.
import type { ThemeColors, ThemeSettings } from '@/types'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/lib/admin-i18n'

type ColorKey = keyof ThemeColors

const FIELDS: { key: ColorKey; label: keyof AdminStrings }[] = [
  { key: 'bg', label: 'colorBg' },
  { key: 'text', label: 'colorText' },
  { key: 'heading', label: 'colorHeading' },
  { key: 'meta', label: 'colorMeta' },
  { key: 'link', label: 'colorLink' },
  { key: 'rule', label: 'colorRule' },
]

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-9 cursor-pointer rounded border border-neutral-300 bg-transparent dark:border-neutral-700"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-lg border border-neutral-300 px-2 py-1 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
      </span>
    </label>
  )
}

function ModeBox({
  title,
  colors,
  onChange,
  onReset,
  t,
}: {
  title: string
  colors: ThemeColors
  onChange: (key: ColorKey, value: string) => void
  onReset: () => void
  t: AdminStrings
}) {
  return (
    <div className="space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">{title}</h3>
        <button type="button" onClick={onReset} className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white">
          {t.resetDefault}
        </button>
      </div>
      {FIELDS.map((f) => (
        <ColorRow key={f.key} label={t[f.label]} value={colors[f.key]} onChange={(v) => onChange(f.key, v)} />
      ))}
    </div>
  )
}

type Props = { theme: ThemeSettings; defaults: ThemeSettings; onChange: (t: ThemeSettings) => void }

export function ThemeFields({ theme, defaults, onChange }: Props) {
  const t = useAdminT()
  const setColor = (mode: keyof ThemeSettings, key: ColorKey, value: string) =>
    onChange({ ...theme, [mode]: { ...theme[mode], [key]: value } })

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.appearanceHint}</p>
      <ModeBox
        title={t.modeLight}
        colors={theme.light}
        onChange={(k, v) => setColor('light', k, v)}
        onReset={() => onChange({ ...theme, light: defaults.light })}
        t={t}
      />
      <ModeBox
        title={t.modeDark}
        colors={theme.dark}
        onChange={(k, v) => setColor('dark', k, v)}
        onReset={() => onChange({ ...theme, dark: defaults.dark })}
        t={t}
      />
    </div>
  )
}
