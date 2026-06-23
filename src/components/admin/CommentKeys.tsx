'use client'

// Key entry for the optional comment integrations (Turnstile + Facebook). These
// are SECRETS, so they have their OWN API (`/api/comments/keys` → server-only
// `integration_keys` table), NOT the settings form. Inputs are write-to-set: a
// blank field leaves the stored key untouched (only non-empty fields are sent).
// Sections show only for the toggles that are on.
import { useState } from 'react'
import type { CommentSettings, ApiResponse } from '@/types'
import type { CommentEnv } from '@/lib/comment-env'
import { useToast } from '@/components/ui/Toast'
import { useAdminT } from './I18nProvider'

const INPUT =
  'w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100'

// External setup links (where the owner gets each integration's keys / settings).
const LINKS = {
  turnstile: 'https://dash.cloudflare.com/?to=/:account/turnstile',
  facebook: 'https://developers.facebook.com/apps/',
  google: 'https://console.cloud.google.com/apis/credentials/consent',
}

type Keys = { turnstileSiteKey: string; turnstileSecretKey: string; facebookId: string; facebookSecret: string }
const EMPTY: Keys = { turnstileSiteKey: '', turnstileSecretKey: '', facebookId: '', facebookSecret: '' }

// One integration's title + help line with an "Open ↗" link to its setup page.
function Help({ title, text, href, open }: { title: string; text: string; href: string; open: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-400">{title}</p>
      <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {text}{' '}
        <a href={href} target="_blank" rel="noopener" className="font-medium underline hover:text-neutral-900 dark:hover:text-white">
          {open}
        </a>
      </p>
    </div>
  )
}

export function CommentKeys({ comments, env }: { comments: CommentSettings; env: CommentEnv }) {
  const t = useAdminT()
  const { notify } = useToast()
  const [keys, setKeys] = useState<Keys>(EMPTY)
  const [busy, setBusy] = useState(false)
  const showTurnstile = comments.enabled && comments.turnstile
  const showGoogle = comments.enabled && comments.googleAuth
  const showFacebook = comments.enabled && comments.facebookAuth
  if (!showTurnstile && !showGoogle && !showFacebook) return null

  const set = (k: keyof Keys, v: string) => setKeys((p) => ({ ...p, [k]: v }))
  // A placeholder hinting the field is already configured (so blank = keep).
  const ph = (configured: boolean, label: string) => (configured ? `${label} · ${t.commentsKeySet}` : label)

  async function save() {
    setBusy(true)
    // Send only non-empty fields, so a blank input never clears a stored key.
    const body: Partial<Keys> = {}
    for (const k of Object.keys(keys) as (keyof Keys)[]) if (keys[k].trim()) body[k] = keys[k].trim()
    try {
      const res = await fetch('/api/comments/keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as ApiResponse
      if (!json.success) throw new Error(json.error)
      setKeys(EMPTY)
      notify(t.commentsKeySaved)
    } catch {
      notify(t.deleteFailed, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
      {showTurnstile && (
        <div className="space-y-2">
          <Help title={t.commentsTurnstile} text={t.commentsTurnstileHelp} href={LINKS.turnstile} open={t.commentsHelpOpen} />
          <input className={INPUT} placeholder={ph(!!env.turnstileSiteKey, t.commentsKeySite)} value={keys.turnstileSiteKey} onChange={(e) => set('turnstileSiteKey', e.target.value)} />
          <input className={INPUT} type="password" placeholder={ph(env.turnstileConfigured, t.commentsKeySecret)} value={keys.turnstileSecretKey} onChange={(e) => set('turnstileSecretKey', e.target.value)} />
        </div>
      )}
      {showGoogle && (
        <Help title={t.commentsGoogleAuth} text={t.commentsGoogleHelp} href={LINKS.google} open={t.commentsHelpOpen} />
      )}
      {showFacebook && (
        <div className="space-y-2">
          <Help title={t.commentsFacebookAuth} text={t.commentsFacebookHelp} href={LINKS.facebook} open={t.commentsHelpOpen} />
          <input className={INPUT} placeholder={ph(env.facebookConfigured, t.commentsKeyFbId)} value={keys.facebookId} onChange={(e) => set('facebookId', e.target.value)} />
          <input className={INPUT} type="password" placeholder={ph(env.facebookConfigured, t.commentsKeyFbSecret)} value={keys.facebookSecret} onChange={(e) => set('facebookSecret', e.target.value)} />
        </div>
      )}
      {(showTurnstile || showFacebook) && (
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {t.commentsKeySave}
        </button>
      )}
    </div>
  )
}
