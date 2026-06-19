'use client'

// Header navigation: configurable links (pages, categories, custom URLs) set in
// admin settings. Shown inline on desktop; collapses to a dropdown on mobile.
import { useState } from 'react'
import Link from 'next/link'
import type { MenuItem, SiteLang } from '@/types'
import { t } from '@/lib/i18n'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

  const inlineCls =
    'rounded-lg px-2.5 py-1.5 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white'
  const dropCls =
    'block px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800'

  return (
    <>
      {/* Desktop: links inline. */}
      <nav className="hidden items-center gap-1 sm:flex">
        {items.map((item, i) => (
          <MenuLink key={`${item.href}-${i}`} item={item} className={inlineCls} />
        ))}
      </nav>

      {/* Mobile: hamburger -> dropdown. */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={t(lang).menu}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
        >
          <MenuIcon />
        </button>
        {open && (
          <>
            <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={() => setOpen(false)} />
            <div className="absolute right-0 z-50 mt-2 w-52 overflow-hidden rounded-xl border border-neutral-200 bg-white py-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
              {items.map((item, i) => (
                <MenuLink key={`${item.href}-${i}`} item={item} className={dropCls} onNavigate={() => setOpen(false)} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
