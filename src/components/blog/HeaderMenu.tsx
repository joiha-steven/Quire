'use client'

// Header navigation: configurable links (pages, categories, custom URLs) set in
// admin settings. A hamburger button (desktop + mobile) opens a dropdown.
// Below the rail breakpoint the dropdown ALSO carries the sidebar: the post's
// table of contents (via MenuContext) and the site index passed in as `index`.
import { useState } from 'react'
import Link from 'next/link'
import type { MenuItem, SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { ICON_BTN } from '@/components/ui/iconButton'
import { useMenuHeadings } from './MenuContext'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 6h16M4 12h16M4 18h16" />
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

export function HeaderMenu({
  items,
  lang,
  index,
  tocTitle,
}: {
  items: MenuItem[]
  lang: SiteLang
  index?: React.ReactNode // categories + tags, server-rendered; menu-only (the rail has its own copy)
  tocTitle: string
}) {
  const [open, setOpen] = useState(false)
  const headings = useMenuHeadings()
  // Nothing to put in the menu at all -> no button.
  if (items.length === 0 && !index && headings.length === 0) return null

  const dropCls = 'block px-3 py-2 t-small text-text hover:bg-rule'
  const close = () => setOpen(false)

  function goId(e: React.MouseEvent, id: string) {
    e.preventDefault()
    close()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t(lang).menu}
        aria-expanded={open}
        className={ICON_BTN}
      >
        <MenuIcon />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" aria-hidden onClick={close} />
          <div className="absolute right-0 z-50 mt-2 max-h-[75vh] w-72 max-w-[85vw] overflow-y-auto border border-rule bg-bg py-1 shadow-lg">
            {items.map((item, i) => (
              <MenuLink key={`${item.href}-${i}`} item={item} className={dropCls} onNavigate={close} />
            ))}

            {/* The sidebar, folded into the menu. Only reachable below the rail
                breakpoint, where the rail itself is hidden. */}
            {headings.length > 0 && (
              <nav aria-label={tocTitle} className="rail-hidden mt-2 border-t border-rule px-3 pt-3 pb-1">
                <h2 className="mb-2 t-small font-semibold text-heading">{tocTitle}</h2>
                <ul>
                  {headings.map((h) => (
                    <li key={h.id} className="mt-2 first:mt-0">
                      <a href={`#${h.id}`} onClick={(e) => goId(e, h.id)} className="block t-small text-meta hover:text-heading">
                        {h.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            )}

            {index && (
              <div className="rail-hidden mt-2 border-t border-rule px-3 pt-3 pb-1" onClick={close}>
                {index}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
