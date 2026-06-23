'use client'

// The comment composer + the OAuth sign-in buttons. Split out of Comments.tsx
// (the island/tree) to keep each file focused. The parent owns submit/optimistic;
// this is a controlled form that validates, gates on Turnstile, and reports busy/error.
import { useCallback, useState } from 'react'
import { signIn } from 'next-auth/react'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { Turnstile } from './Turnstile'

export const MAX = 1000
export type Draft = { name: string; email: string; website: string; content: string }
const EMPTY: Draft = { name: '', email: '', website: '', content: '' }

const inputClass =
  't-small w-full rounded-lg border border-rule bg-bg px-3 py-2 text-text outline-none focus:border-heading'

export function SignInButton({ label, provider }: { label: string; provider: 'google' | 'facebook' }) {
  return (
    <button
      type="button"
      onClick={() => signIn(provider, { callbackUrl: window.location.href })}
      className="t-small rounded-lg border border-rule px-3 py-2 text-text hover:bg-rule"
    >
      {label}
    </button>
  )
}

export function CommentForm({
  lang,
  onSubmit,
  turnstile,
  turnstileSiteKey,
  viewer = false,
  autoFocus,
}: {
  lang: SiteLang
  onSubmit: (draft: Draft, token: string | null) => Promise<boolean>
  turnstile: boolean
  turnstileSiteKey: string
  viewer?: boolean
  autoFocus?: boolean
}) {
  const s = t(lang)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const set = (k: keyof Draft, v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const onToken = useCallback((tk: string | null) => setToken(tk), [])

  // A signed-in viewer needs no identity fields and no Turnstile (the server
  // trusts the session). Otherwise: name + email, and Turnstile (if on) must be
  // solved before the content step — identity first so the gate is meaningful.
  const showWidget = turnstile && !!turnstileSiteKey && !viewer
  const identityOk = viewer || (!!draft.name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim()))
  const gateOpen = !showWidget || !!token
  const valid = identityOk && draft.content.trim() && gateOpen

  async function handle(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true)
    setError(false)
    const okied = await onSubmit({ ...draft, content: draft.content.slice(0, MAX) }, token)
    setBusy(false)
    if (okied) {
      setDraft(EMPTY)
      setToken(null) // tokens are single-use — force a fresh solve for the next one
    } else {
      setError(true)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-2.5">
      {!viewer && (
        <div className="grid gap-2.5 sm:grid-cols-3">
          <input
            className={inputClass}
            placeholder={s.commentName}
            value={draft.name}
            onChange={(e) => set('name', e.target.value)}
            autoFocus={autoFocus}
            maxLength={80}
          />
          <input
            className={inputClass}
            type="email"
            placeholder={`${s.commentEmail} · ${s.commentEmailNote}`}
            value={draft.email}
            onChange={(e) => set('email', e.target.value)}
            maxLength={120}
          />
          <input
            className={inputClass}
            placeholder={s.commentWebsite}
            value={draft.website}
            onChange={(e) => set('website', e.target.value)}
          />
        </div>
      )}

      {/* Gate: with Turnstile on, the widget appears once identity is filled and
          must be solved before the comment box is shown. */}
      {showWidget && !gateOpen ? (
        identityOk && <Turnstile siteKey={turnstileSiteKey} onToken={onToken} />
      ) : (
        <>
          <textarea
            className={`${inputClass} min-h-[6rem] resize-y`}
            placeholder={s.commentBody}
            value={draft.content}
            onChange={(e) => set('content', e.target.value.slice(0, MAX))}
          />
          <div className="flex items-center justify-between gap-3">
            <span className="t-small text-meta">
              {s.commentFormatHint} · {draft.content.length}/{MAX}
            </span>
            <button
              type="submit"
              disabled={!valid || busy}
              className="t-small rounded-lg border border-heading bg-heading px-4 py-2 font-medium text-bg transition-opacity disabled:opacity-40"
            >
              {busy ? s.commentSubmitting : s.commentSubmit}
            </button>
          </div>
        </>
      )}
      {error && <p className="t-small text-meta">{s.commentError}</p>}
    </form>
  )
}
