'use client'

// Controlled comment-system toggles. Parent owns state + save. The master switch
// is always shown; the integration toggles (Turnstile, Google/Facebook login)
// appear once comments are on. Each integration is only EFFECTIVE when its env
// keys exist (`env`); the row shows a "needs key" badge otherwise.
import type { CommentSettings } from '@/types'
import type { CommentEnv } from '@/lib/comment-env'
import { ToggleRow } from '@/components/ui/Switch'
import { useAdminT } from './I18nProvider'

type Props = {
  comments: CommentSettings
  env: CommentEnv
  onChange: (c: CommentSettings) => void
}

export function CommentFields({ comments, env, onChange }: Props) {
  const t = useAdminT()
  // Flag a toggle whose env keys are missing (so it won't actually take effect).
  const needsKey = (on: boolean, configured: boolean) => (on && !configured ? t.commentsNeedsKey : undefined)
  return (
    <div className="divide-y divide-neutral-200 overflow-hidden rounded-xl border border-neutral-200 dark:divide-neutral-800 dark:border-neutral-800">
      <ToggleRow
        label={t.commentsEnable}
        desc={t.commentsEnableDesc}
        checked={comments.enabled}
        onChange={(enabled) => onChange({ ...comments, enabled })}
      />
      {comments.enabled && (
        <>
          <ToggleRow
            label={t.commentsTurnstile}
            desc={t.commentsTurnstileDesc}
            badge={needsKey(comments.turnstile, env.turnstileConfigured)}
            checked={comments.turnstile}
            onChange={(turnstile) => onChange({ ...comments, turnstile })}
          />
          <ToggleRow
            label={t.commentsGoogleAuth}
            desc={t.commentsAuthDesc}
            badge={needsKey(comments.googleAuth, env.googleConfigured)}
            checked={comments.googleAuth}
            onChange={(googleAuth) => onChange({ ...comments, googleAuth })}
          />
          <ToggleRow
            label={t.commentsFacebookAuth}
            desc={t.commentsAuthDesc}
            badge={needsKey(comments.facebookAuth, env.facebookConfigured)}
            checked={comments.facebookAuth}
            onChange={(facebookAuth) => onChange({ ...comments, facebookAuth })}
          />
        </>
      )}
    </div>
  )
}
