'use client'

// Shared error UI — visually identical to the 404 ((blog)/not-found.tsx): big
// number, title, text, actions, all on theme tokens. Used by every error boundary.
// Client component (boundaries must be), so the language is read from <html lang>
// (set by the root layout) with an English fallback.
import Link from 'next/link'
import { useState } from 'react'
import { t } from '@/lib/i18n'
import { isSiteLang } from '@/locales/langs'
import type { SiteLang } from '@/types'

export function ErrorView({ code = '500', reset }: { code?: string; reset?: () => void }) {
  // Read the active language once from <html lang> (set by the root layout); SSR has
  // no document → English. Lazy init keeps it a single read with no setState/effect.
  const [lang] = useState<SiteLang>(() => {
    if (typeof document === 'undefined') return 'en'
    const l = document.documentElement.lang
    return isSiteLang(l) ? l : 'en'
  })
  const s = t(lang)
  return (
    <div className="py-24 text-center">
      <p className="text-6xl font-bold tracking-tight text-heading">{code}</p>
      <h1 className="mt-4 fs-h3 font-semibold">{s.errorTitle}</h1>
      <p className="mt-2 text-meta">{s.errorText}</p>
      <div className="mt-8 flex items-center justify-center gap-5">
        {reset && (
          <button type="button" onClick={reset} className="t-small font-medium text-link underline underline-offset-4">
            {s.tryAgain}
          </button>
        )}
        <Link href="/" className="t-small font-medium text-link underline underline-offset-4">{s.backHome}</Link>
      </div>
    </div>
  )
}
