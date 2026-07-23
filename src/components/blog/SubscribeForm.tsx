'use client'

// Public newsletter sign-up. Posts to /api/subscribe (double opt-in) and shows an
// inline status. Rendered only when SMTP is configured (see the post page). Colours
// come from theme tokens, matching the reading surface.
import { useState } from 'react'
import type { SiteLang, ApiResponse } from '@/types'
import { t } from '@/lib/i18n'

export function SubscribeForm({ lang }: { lang: SiteLang }) {
  const tx = t(lang)
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'done' | 'already' | 'error'>('idle')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || busy) return
    setBusy(true)
    setState('idle')
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const j = (await res.json()) as ApiResponse<{ status: string }>
      if (!res.ok || !j.success) {
        setState('error')
        return
      }
      setState(j.data?.status === 'already' ? 'already' : 'done')
      setEmail('')
    } catch {
      setState('error')
    } finally {
      setBusy(false)
    }
  }

  const msg = state === 'done' ? tx.nlSuccess : state === 'already' ? tx.nlAlready : state === 'error' ? tx.nlError : ''

  return (
    <section className="rounded-lg border border-rule bg-bg p-5">
      <h2 className="t-small mb-3 font-semibold text-heading">{tx.nlHeading}</h2>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={tx.nlPlaceholder}
          aria-label={tx.nlPlaceholder}
          className="t-small min-w-0 flex-1 rounded-lg border border-rule bg-bg px-3 py-2 text-text outline-none focus:border-heading"
        />
        <button
          type="submit"
          disabled={busy}
          className="t-small rounded-lg border border-rule px-4 py-2 font-medium text-heading transition-colors hover:bg-rule disabled:opacity-50"
        >
          {tx.nlButton}
        </button>
      </form>
      {msg && <p className="t-small mt-2 text-meta">{msg}</p>}
    </section>
  )
}
