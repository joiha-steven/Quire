'use client'

// Rendering/behaviour toggles: font smoothing (anti-aliasing) + the site-wide
// motion engine. Per-role size/line/spacing live in TypographyFields (Appearance);
// custom CSS is a sibling card. Parent owns save.
import type { TypographySettings, MotionSettings } from '@/types'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

type Props = {
  typography: TypographySettings
  onTypography: (t: TypographySettings) => void
  motion: MotionSettings
  onMotion: (m: MotionSettings) => void
}

export function AdvancedFields({ typography, onTypography, motion, onMotion }: Props) {
  const t = useAdminT()
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      <ToggleRow
        label={t.fontSmoothing}
        desc={t.fontSmoothingDesc}
        checked={typography.smoothing}
        onChange={(smoothing) => onTypography({ ...typography, smoothing })}
      />
      <ToggleRow
        label={t.motionLabel}
        desc={t.motionDesc}
        checked={motion.enabled}
        onChange={(enabled) => onMotion({ ...motion, enabled })}
      />
      <ToggleRow
        label={t.typewriterLabel}
        desc={t.typewriterDesc}
        checked={motion.typewriter}
        onChange={(typewriter) => onMotion({ ...motion, typewriter })}
      />
    </div>
  )
}
