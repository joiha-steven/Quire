'use client'

// Controlled per-mode reading colors (light + dark) + a built-in palette picker.
// Picking a preset fills both modes from that palette and remembers its id, so
// the per-mode "reset" restores THAT preset's colors (not a single global default).
// Parent owns state + save.
import type { ThemeColors, ThemeSettings } from '@/types'
import type { ThemePreset } from '@/lib/themes'
import { cloneTheme } from '@/lib/themes'
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

function PresetCard({ preset, selected, onPick }: { preset: ThemePreset; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={`group overflow-hidden rounded-xl border text-left transition ${
        selected
          ? 'border-neutral-900 ring-2 ring-neutral-900 dark:border-white dark:ring-white'
          : 'border-neutral-200 hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600'
      }`}
    >
      <div className="flex h-10">
        <MiniMode c={preset.theme.light} />
        <MiniMode c={preset.theme.dark} />
      </div>
      <div className="border-t border-neutral-200 px-2 py-1 text-xs font-medium dark:border-neutral-800">{preset.name}</div>
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
  selectedId: string
  theme: ThemeSettings
  onSelectPreset: (id: string, theme: ThemeSettings) => void
  onChange: (t: ThemeSettings) => void
  customCss: string
  onCustomCss: (v: string) => void
}

export function ThemeFields({ presets, selectedId, theme, onSelectPreset, onChange, customCss, onCustomCss }: Props) {
  const t = useAdminT()
  // The palette the per-mode reset buttons restore to (the selected preset).
  const active = presets.find((p) => p.id === selectedId) ?? presets[0]
  const setColor = (mode: keyof ThemeSettings, key: ColorKey, value: string) =>
    onChange({ ...theme, [mode]: { ...theme[mode], [key]: value } })

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.appearanceHint}</p>

      <div className="space-y-2">
        <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">{t.themePreset}</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {presets.map((p) => (
            <PresetCard
              key={p.id}
              preset={p}
              selected={p.id === selectedId}
              // Clone so later per-color edits never mutate the shared preset object.
              onPick={() => onSelectPreset(p.id, cloneTheme(p.theme))}
            />
          ))}
        </div>
        <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.themePresetHint}</p>
      </div>

      <ModeBox
        title={t.modeLight}
        colors={theme.light}
        onChange={(k, v) => setColor('light', k, v)}
        onReset={() => onChange({ ...theme, light: { ...active.theme.light } })}
        t={t}
      />
      <ModeBox
        title={t.modeDark}
        colors={theme.dark}
        onChange={(k, v) => setColor('dark', k, v)}
        onReset={() => onChange({ ...theme, dark: { ...active.theme.dark } })}
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
