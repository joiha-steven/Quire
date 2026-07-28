'use client'

// The header newsletter button. Opens the sign-up form in a modal instead of making
// the reader scroll to the foot of a post (the in-page form stays where it is).
// Rendered only when SMTP is configured — see the blog layout.
import { useState } from 'react'
import dynamic from 'next/dynamic'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { ICON_BTN } from '@/components/ui/iconButton'

// Load the overlay chunk only on first open — same rule as the search button.
const SubscribeOverlay = dynamic(() => import('./SubscribeOverlay').then((m) => ({ default: m.SubscribeOverlay })), { ssr: false })

export function SubscribeTrigger({ lang }: { lang: SiteLang }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t(lang).nlHeading} className={ICON_BTN}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <rect x="3" y="5.5" width="18" height="13" rx="2" />
          <path d="m3.5 7 8.5 6 8.5-6" />
        </svg>
      </button>
      {open && <SubscribeOverlay lang={lang} onClose={() => setOpen(false)} />}
    </>
  )
}
