'use client'

// Controlled reader-feature toggles. Parent owns state + save.
import type { FeatureSettings } from '@/types'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

type Props = { features: FeatureSettings; onChange: (f: FeatureSettings) => void }

export function FeatureFields({ features, onChange }: Props) {
  const t = useAdminT()
  const ITEMS: { key: keyof FeatureSettings; label: string; desc: string }[] = [
    { key: 'search', label: t.featSearch, desc: t.featSearchDesc },
    { key: 'toc', label: t.featToc, desc: t.featTocDesc },
    { key: 'related', label: t.featRelated, desc: t.featRelatedDesc },
    { key: 'readingTime', label: t.featReadingTime, desc: t.featReadingTimeDesc },
    { key: 'progressBar', label: t.featProgress, desc: t.featProgressDesc },
  ]
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      {ITEMS.map((f) => (
        <ToggleRow
          key={f.key}
          label={f.label}
          desc={f.desc}
          checked={features[f.key]}
          onChange={(v) => onChange({ ...features, [f.key]: v })}
        />
      ))}
    </div>
  )
}
