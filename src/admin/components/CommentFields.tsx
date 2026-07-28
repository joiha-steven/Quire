// The comment MASTER switch, and nothing else.
//
// Turnstile and Google sign-in moved to Settings -> Connections, with the keys they need:
// they are external services this site talks to, which is what that tab is for, and having
// the toggle in one tab and its credentials in another was the arrangement that let
// `googleAuth` sit switched on for weeks controlling nothing.
import type { CommentSettings } from '@/types'
import { ToggleRow } from '@/admin/ui/Switch'
import { useAdminT } from './I18nProvider'
import { PANEL_LIST } from './kit'

type Props = {
  comments: CommentSettings
  onChange: (c: CommentSettings) => void
}

export function CommentFields({ comments, onChange }: Props) {
  const t = useAdminT()
  return (
    <div className={PANEL_LIST}>
      <ToggleRow
        label={t.commentsEnable}
        desc={t.commentsEnableDesc}
        checked={comments.enabled}
        onChange={(enabled) => onChange({ ...comments, enabled })}
      />
    </div>
  )
}