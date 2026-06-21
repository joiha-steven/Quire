'use client'

// The font-smoothing (anti-aliasing) toggle. Per-role size/line/spacing live in
// TypographyFields (Appearance); custom CSS is a sibling card. Parent owns save.
import type { TypographySettings } from '@/types'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

type Props = {
  typography: TypographySettings
  onTypography: (t: TypographySettings) => void
}

export function AdvancedFields({ typography, onTypography }: Props) {
  const t = useAdminT()
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
      <ToggleRow
        label={t.fontSmoothing}
        desc={t.fontSmoothingDesc}
        checked={typography.smoothing}
        onChange={(smoothing) => onTypography({ ...typography, smoothing })}
      />
    </div>
  )
}
