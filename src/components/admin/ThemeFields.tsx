'use client'

// Per-palette color editor. The 6 built-in palettes are each independently
// customizable: the picker chooses WHICH palette you're editing; its light+dark
// colors are saved under settings.themes[id]; "reset" restores that palette's
// built-in colors. One palette is marked the visitor default (settings.themePreset)
// — switchable here with "Set as default". Parent owns state + save.
import { useState } from 'react'
import type { ThemeColors, ThemeSettings } from '@/types'
import type { ThemePreset } from '@/lib/themes'
import { getPreset } from '@/lib/themes'
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

// A tiny live preview of one mode: background with a heading bar, a body line,
// and a link dot — enough to read the palette's character at a glance.
function MiniMode({ c }: { c: ThemeColors }) {
  return (
    <div className="flex-1 space-y-1 p-2" style={{ background: c.bg }}>
      <div className="h-1.5 w-3/4 rounded-full" style={{ background: c.heading }} />
      <div className="h-1 w-full rounded-full" style={{ background: c.text, opacity: 0.6 }} />
      <div className="h-1 w-1/2 rounded-full" style={{ background: c.link }} />
    </div>
  )
}

function PresetCard({
  name,
  theme,
  editing,
  isDefault,
  defaultLabel,
  onPick,
}: {
  name: string
  theme: ThemeSettings
  editing: boolean
  isDefault: boolean
  defaultLabel: string
  onPick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={editing}
      className={`group overflow-hidden rounded-xl border text-left transition ${
        editing
          ? 'border-neutral-900 ring-2 ring-neutral-900 dark:border-white dark:ring-white'
          : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600'
      }`}
    >
      <div className="flex h-10">
        <MiniMode c={theme.light} />
        <MiniMode c={theme.dark} />
      </div>
      <div className="flex items-center justify-between gap-1 border-t border-neutral-200 px-2 py-1 dark:border-neutral-800">
        <span className="text-xs font-medium">{name}</span>
        {isDefault && (
          <span className="rounded bg-neutral-900 px-1.5 py-0.5 text-[10px] font-medium text-white dark:bg-white dark:text-neutral-900">
            {defaultLabel}
          </span>
        )}
      </div>
    </button>
  )
}

function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label}
          className="h-9 w-14 rounded-lg border border-neutral-300 ring-1 ring-inset ring-black/5 dark:border-neutral-700"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-24 rounded-lg border border-neutral-300 px-2 py-1 font-mono text-sm uppercase outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
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

type Props = {
  presets: ThemePreset[]
  themes: Record<string, ThemeSettings>
  defaultId: string
  onChangeThemes: (themes: Record<string, ThemeSettings>) => void
  onSetDefault: (id: string) => void
  customCss: string
  onCustomCss: (v: string) => void
}

export function ThemeFields({ presets, themes, defaultId, onChangeThemes, onSetDefault, customCss, onCustomCss }: Props) {
  const t = useAdminT()
  // Which palette is being edited (local UI state — start at the visitor default).
  const [editingId, setEditingId] = useState(defaultId)
  const theme = themes[editingId] ?? getPreset(editingId).theme
  const builtin = getPreset(editingId).theme

  const setColor = (mode: keyof ThemeSettings, key: ColorKey, value: string) =>
    onChangeThemes({ ...themes, [editingId]: { ...theme, [mode]: { ...theme[mode], [key]: value } } })
  const resetMode = (mode: keyof ThemeSettings) =>
    onChangeThemes({ ...themes, [editingId]: { ...theme, [mode]: { ...builtin[mode] } } })

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.appearanceHint}</p>

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.themePreset}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              name={p.name}
              theme={themes[p.id] ?? p.theme}
              editing={p.id === editingId}
              isDefault={p.id === defaultId}
              defaultLabel={t.themeDefault}
              onPick={() => setEditingId(p.id)}
            />
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.themePresetHint}</p>
          {editingId !== defaultId && (
            <button
              type="button"
              onClick={() => onSetDefault(editingId)}
              className="shrink-0 text-xs font-medium text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white"
            >
              {t.themeSetDefault}
            </button>
          )}
        </div>
      </div>

      <ModeBox
        title={t.modeLight}
        colors={theme.light}
        onChange={(k, v) => setColor('light', k, v)}
        onReset={() => resetMode('light')}
        t={t}
      />
      <ModeBox
        title={t.modeDark}
        colors={theme.dark}
        onChange={(k, v) => setColor('dark', k, v)}
        onReset={() => resetMode('dark')}
        t={t}
      />
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.customCss}</span>
        <textarea
          value={customCss}
          onChange={(e) => onCustomCss(e.target.value)}
          rows={6}
          spellCheck={false}
          placeholder={'.prose h2 { letter-spacing: -0.01em }'}
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 font-mono text-xs outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.customCssHint}</p>
      </div>
    </div>
  )
}
