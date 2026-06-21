'use client'

// Controlled reader-feature toggles. Parent owns state + save.
import type { FeatureSettings } from '@/types'
import { Input } from '@/components/ui/Input'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

type Props = {
  features: FeatureSettings
  onChange: (f: FeatureSettings) => void
  relatedCount: number
  onRelatedCount: (n: number) => void
}

export function FeatureFields({ features, onChange, relatedCount, onRelatedCount }: Props) {
  const t = useAdminT()
  const ITEMS: { key: keyof FeatureSettings; label: string; desc: string }[] = [
    { key: 'search', label: t.featSearch, desc: t.featSearchDesc },
    { key: 'toc', label: t.featToc, desc: t.featTocDesc },
    { key: 'related', label: t.featRelated, desc: t.featRelatedDesc },
    { key: 'readingTime', label: t.featReadingTime, desc: t.featReadingTimeDesc },
    { key: 'progressBar', label: t.featProgress, desc: t.featProgressDesc },
    { key: 'activityLog', label: t.featActivityLog, desc: t.featActivityLogDesc },
  ]
  return (
    <div className="space-y-4">
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
      {features.related && (
        <div className="space-y-1.5">
          <Input
            label={t.relatedCount}
            type="number"
            min={0}
            max={12}
            value={relatedCount}
            onChange={(e) => onRelatedCount(Number(e.target.value))}
          />
          <p className="text-xs text-neutral-400 dark:text-neutral-500">{t.relatedCountHint}</p>
        </div>
      )}
    </div>
  )
}
