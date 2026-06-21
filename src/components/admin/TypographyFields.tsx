'use client'

// Per-role type editor: every text role (h1–h5, body, small, caption, code) has
// its own size (rem), line-height, and letter-spacing (em) — the full set of CSS
// vars the site renders from. One reset restores all roles to the tuned defaults.
// Parent owns state + save.
import type { TypographySettings, TypeRole, TypeStyle } from '@/types'
import { DEFAULT_TYPOGRAPHY, TYPE_ROLES } from '@/lib/themes'
import { useAdminT } from './I18nProvider'
import type { AdminStrings } from '@/lib/admin-i18n'

const ROLE_LABEL: Record<TypeRole, keyof AdminStrings> = {
  h1: 'typoH1',
  h2: 'typoH2',
  h3: 'typoH3',
  h4: 'typoH4',
  h5: 'typoH5',
  body: 'typoBody',
  small: 'typoSmall',
  caption: 'typoCaption',
  code: 'typoCode',
}

// One numeric cell. `dim` keys map to the TypeStyle fields with their own ranges.
function Cell({
  value,
  step,
  min,
  max,
  onChange,
}: {
  value: number
  step: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-16 rounded-md border border-neutral-300 px-1.5 py-1 text-right font-mono text-xs outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
    />
  )
}

type Props = {
  typography: TypographySettings
  onChange: (typography: TypographySettings) => void
}

export function TypographyFields({ typography, onChange }: Props) {
  const t = useAdminT()
  const setStyle = (role: TypeRole, patch: Partial<TypeStyle>) =>
    onChange({ ...typography, roles: { ...typography.roles, [role]: { ...typography.roles[role], ...patch } } })
  // Reset every role's size/line/spacing; keep the smoothing toggle (Advanced tab).
  const resetAll = () => onChange({ ...typography, roles: structuredClone(DEFAULT_TYPOGRAPHY.roles) })

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t.typographyHint}</p>
        <button
          type="button"
          onClick={resetAll}
          className="shrink-0 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-white"
        >
          {t.resetDefault}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-xs text-neutral-400 dark:text-neutral-500">
              <th className="text-left font-medium" />
              <th className="px-1 text-right font-medium">{t.colSize}</th>
              <th className="px-1 text-right font-medium">{t.colLine}</th>
              <th className="px-1 text-right font-medium">{t.colSpacing}</th>
            </tr>
          </thead>
          <tbody>
            {TYPE_ROLES.map((role) => {
              const s = typography.roles[role]
              return (
                <tr key={role}>
                  <td className="pr-2 text-neutral-700 dark:text-neutral-300">{t[ROLE_LABEL[role]] as string}</td>
                  <td className="px-1 text-right">
                    <Cell value={s.size} step={0.01} min={0.5} max={6} onChange={(v) => setStyle(role, { size: v })} />
                  </td>
                  <td className="px-1 text-right">
                    <Cell value={s.line} step={0.05} min={0.8} max={3} onChange={(v) => setStyle(role, { line: v })} />
                  </td>
                  <td className="px-1 text-right">
                    <Cell value={s.spacing} step={0.005} min={-0.2} max={0.5} onChange={(v) => setStyle(role, { spacing: v })} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.typographyUnits}</p>

      {/* Live preview of the heading roles + body, each at its own style. */}
      <div className="space-y-1.5 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        {(['h1', 'h2', 'h3'] as const).map((k) => (
          <p
            key={k}
            className="truncate font-semibold text-neutral-900 dark:text-white"
            style={{ fontSize: `${typography.roles[k].size}rem`, lineHeight: typography.roles[k].line, letterSpacing: `${typography.roles[k].spacing}em` }}
          >
            {k.toUpperCase()} · {t.typographyPreview}
          </p>
        ))}
        <p
          className="text-neutral-500 dark:text-neutral-400"
          style={{ fontSize: `${typography.roles.body.size}rem`, lineHeight: typography.roles.body.line }}
        >
          {t.typographyPreviewBody}
        </p>
      </div>
    </div>
  )
}
