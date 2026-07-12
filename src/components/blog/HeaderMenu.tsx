'use client'

// Header navigation: configurable links (pages, categories, custom URLs) set in
// admin settings. A hamburger button (desktop + mobile) opens a dropdown.
import { useState } from 'react'
import Link from 'next/link'
import type { MenuItem, SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { ICON_BTN } from '@/components/ui/iconButton'

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <path d="M5 7.5h14M5 12h10M5 16.5h14" />
    </svg>
  )
}

// Internal links use next/link; external (http) use a plain anchor.
function MenuLink({ item, className, onNavigate }: { item: MenuItem; className: string; onNavigate?: () => void }) {
  if (/^https?:\/\//.test(item.href)) {
    return (
      <a href={item.href} target="_blank" rel="noopener" className={className} onClick={onNavigate}>
        {item.label}
      </a>
    )
  }
  return (
    <Link href={item.href || '/'} className={className} onClick={onNavigate}>
      {item.label}
    </Link>
  )
}

export function HeaderMenu({ items, lang }: { items: MenuItem[]; lang: SiteLang }) {
  const [open, setOpen] = useState(false)
  if (items.length === 0) return null

  const dropCls = 'block px-3 py-2 t-small text-text hover:bg-rule'

  // Hamburger -> dropdown, on every breakpoint.
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t(lang).menu}
        className={ICON_BTN}
      >
        <MenuIcon />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-rule bg-bg py-1 shadow-lg">
            {items.map((item, i) => (
              <MenuLink key={`${item.href}-${i}`} item={item} className={dropCls} onNavigate={() => setOpen(false)} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
