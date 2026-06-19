'use client'

// Appearance settings: per-mode reading colors (light + dark). Saves only the
// `theme` slice via PUT /api/settings (which merges over current settings).
import { useState } from 'react'
import type { ThemeColors, ThemeSettings, SiteSettings, ApiResponse } from '@/types'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/lib/admin-i18n'

type ColorKey = keyof ThemeColors
type Mode = keyof ThemeSettings

const FIELDS: { key: ColorKey; label: keyof AdminStrings }[] = [
  { key: 'bg', label: 'colorBg' },
  { key: 'text', label: 'colorText' },
  { key: 'heading', label: 'colorHeading' },
  { key: 'meta', label: 'colorMeta' },
  { key: 'link', label: 'colorLink' },
  { key: 'rule', label: 'colorRule' },
]

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
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

function ModeColumn({
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
    <div className="flex-1 space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">{title}</h2>
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

export function AppearanceForm({ initial, defaults }: { initial: ThemeSettings; defaults: ThemeSettings }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [theme, setTheme] = useState<ThemeSettings>(initial)
  const [saving, setSaving] = useState(false)

  const setColor = (mode: Mode, key: ColorKey, value: string) =>
    setTheme((prev) => ({ ...prev, [mode]: { ...prev[mode], [key]: value } }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      })
      const json = (await res.json()) as ApiResponse<SiteSettings>
      if (!json.success) throw new Error(json.error)
      notify(t.savedSettings)
    } catch {
      notify(t.saveFailed, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.appearanceHint}</p>

      <div className="flex flex-col gap-4 sm:flex-row">
        <ModeColumn
          title={t.modeLight}
          colors={theme.light}
          onChange={(k, v) => setColor('light', k, v)}
          onReset={() => setTheme((p) => ({ ...p, light: defaults.light }))}
          t={t}
        />
        <ModeColumn
          title={t.modeDark}
          colors={theme.dark}
          onChange={(k, v) => setColor('dark', k, v)}
          onReset={() => setTheme((p) => ({ ...p, dark: defaults.dark }))}
          t={t}
        />
      </div>

      <Button onClick={save} disabled={saving}>
        {saving ? t.saving : t.saveSettings}
      </Button>
    </div>
  )
}
