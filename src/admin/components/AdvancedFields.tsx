// Rendering/behaviour toggles: font smoothing (anti-aliasing), the IDE chrome, and the
// site-wide motion engine. Per-role size/line/spacing live in TypographyFields (Appearance);
// custom CSS is a sibling card. Parent owns save.
import type { TypographySettings, MotionSettings } from '@/types'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { PANEL_LIST } from './kit'

type Props = {
  typography: TypographySettings
  onTypography: (t: TypographySettings) => void
  ideChrome: boolean
  onIdeChrome: (v: boolean) => void
  motion: MotionSettings
  onMotion: (m: MotionSettings) => void
}

export function AdvancedFields({ typography, onTypography, ideChrome, onIdeChrome, motion, onMotion }: Props) {
  const t = useAdminT()
  return (
    <div className={PANEL_LIST}>
      <ToggleRow
        label={t.fontSmoothing}
        desc={t.fontSmoothingDesc}
        checked={typography.smoothing}
        onChange={(smoothing) => onTypography({ ...typography, smoothing })}
      />
      {/* One switch for a whole look, because it is a taste rather than a feature: the
          chrome reads as source code while the reading column stays analogue. Off leaves
          no trace - every rule behind it hangs off one attribute selector. */}
      <ToggleRow
        label={t.ideChromeLabel}
        desc={t.ideChromeDesc}
        checked={ideChrome}
        onChange={onIdeChrome}
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