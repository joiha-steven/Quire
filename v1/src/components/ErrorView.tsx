'use client'

// Client wrapper of ErrorScreen for the error boundaries (which must be client).
// Language is read once from <html lang> (set by the root layout); SSR has no
// document → English. Same look as the 404 via the shared ErrorScreen.
import Link from 'next/link'
import { useState } from 'react'
import { t } from '@/lib/i18n'
import { isSiteLang } from '@/locales/langs'
import type { SiteLang } from '@/types'
import { ErrorScreen, ERROR_LINK } from '@/components/ErrorScreen'

export function ErrorView({ code = '500', reset }: { code?: string; reset?: () => void }) {
  const [lang] = useState<SiteLang>(() => {
    if (typeof document === 'undefined') return 'en'
    const l = document.documentElement.lang
    return isSiteLang(l) ? l : 'en'
  })
  const s = t(lang)
  return (
    <ErrorScreen code={code} title={s.errorTitle} text={s.errorText}>
      {reset && (
        <button type="button" onClick={reset} className={ERROR_LINK}>{s.tryAgain}</button>
      )}
      <Link href="/" className={ERROR_LINK}>{s.backHome}</Link>
    </ErrorScreen>
  )
}
