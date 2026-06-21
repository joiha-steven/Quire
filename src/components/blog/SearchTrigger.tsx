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
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
      </button>
      {open && <SearchOverlay lang={lang} onClose={() => setOpen(false)} />}
    </>
  )
}
