'use client'

// Reading rhythm (line-height, letter-spacing) + the font-smoothing toggle.
// Parent owns state + save. Custom CSS is a sibling card in the Advanced tab.
import type { TypographySettings } from '@/types'
import { DEFAULT_TYPOGRAPHY } from '@/lib/themes'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

type RhythmKey = 'lineHeight' | 'letterSpacing'

function NumberRow({
  label,
  value,
  unit,
  step,
  min,
  max,
  onChange,
}: {
  label: string
  value: number
  unit: string
  step: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-neutral-700 dark:text-neutral-300">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={label}
          className="w-20 rounded-lg border border-neutral-300 px-2 py-1 text-right font-mono text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
        />
        {unit && <span className="text-xs text-neutral-400 dark:text-neutral-500">{unit}</span>}
      </span>
    </label>
  )
}

type Props = {
  typography: TypographySettings
  onTypography: (t: TypographySettings) => void
}

export function AdvancedFields({ typography, onTypography }: Props) {
  const t = useAdminT()
  const set = (key: RhythmKey, value: number) =>
    onTypography({ ...typography, [key]: Number.isFinite(value) ? value : typography[key] })
  const resetRhythm = () =>
    onTypography({
      ...typography,
      lineHeight: DEFAULT_TYPOGRAPHY.lineHeight,
      letterSpacing: DEFAULT_TYPOGRAPHY.letterSpacing,
      smoothing: DEFAULT_TYPOGRAPHY.smoothing,
    })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.rhythmHint}</p>
        <button
          type="button"
          onClick={resetRhythm}
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          {t.resetDefault}
        </button>
      </div>
      <div className="space-y-3">
        <NumberRow label={t.lineHeight} value={typography.lineHeight} unit="" step={0.05} min={1} max={3} onChange={(v) => set('lineHeight', v)} />
        <NumberRow label={t.letterSpacing} value={typography.letterSpacing} unit="em" step={0.005} min={-0.1} max={0.5} onChange={(v) => set('letterSpacing', v)} />
      </div>
      <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
        <ToggleRow
          label={t.fontSmoothing}
          desc={t.fontSmoothingDesc}
          checked={typography.smoothing}
          onChange={(smoothing) => onTypography({ ...typography, smoothing })}
        />
      </div>
    </div>
  )
}
