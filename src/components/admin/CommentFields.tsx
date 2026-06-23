'use client'

// Controlled comment-system toggles. Parent owns state + save. Phase A ships the
// master on/off switch; Turnstile + Google/Facebook login toggles are added later.
import type { CommentSettings } from '@/types'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

type Props = {
  comments: CommentSettings
  onChange: (c: CommentSettings) => void
}

export function CommentFields({ comments, onChange }: Props) {
  const t = useAdminT()
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      <ToggleRow
        label={t.commentsEnable}
        desc={t.commentsEnableDesc}
        checked={comments.enabled}
        onChange={(enabled) => onChange({ ...comments, enabled })}
      />
    </div>
  )
}
