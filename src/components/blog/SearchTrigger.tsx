'use client'

// The header search button. Opens the modal SearchOverlay in place instead of
// navigating to /search (the /search route still exists for deep links / no-JS).
import { useState } from 'react'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { ICON_BTN } from '@/components/ui/iconButton'
import { SearchOverlay } from './SearchOverlay'

export function SearchTrigger({ lang }: { lang: SiteLang }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={t(lang).search} className={ICON_BTN}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
          <circle cx="10.25" cy="10.25" r="5.75" />
          <path d="m14.75 14.75 4.75 4.75" />
        </svg>
      </button>
      {open && <SearchOverlay lang={lang} onClose={() => setOpen(false)} />}
    </>
  )
}
