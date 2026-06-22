'use client'

// Admin navigation as a LEFT VERTICAL SIDEBAR (the top bar grew too crowded). On
// desktop it's a sticky full-height column: brand → nav links → controls pinned to
// the bottom. On mobile it collapses to a slim top bar with a hamburger that opens
// the same items as a drawer. Every item (links AND theme/palette/cache/sign-out)
// shares SIDEBAR_NAV so the column reads as one uniform set and can't drift.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { SiteLang } from '@/types'
import { useAdminT } from './I18nProvider'
import { SIDEBAR_NAV, SIDEBAR_NAV_ACTIVE } from './headerActions'
import { CacheButton } from './CacheButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { PaletteToggle, type PaletteOption } from '@/components/theme/PaletteToggle'

export function AdminSidebar({
  lang,
  signOut,
  palettes,
  defaultPalette,
}: {
  lang: SiteLang
  signOut: () => Promise<void>
  palettes: PaletteOption[]
  defaultPalette: string
}) {
  const t = useAdminT()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const links = [
    { href: '/admin', label: t.navHome },
    { href: '/admin/analytics', label: t.navAnalytics },
    { href: '/admin/content', label: t.navDashboard },
    { href: '/admin/media', label: t.navMedia },
    { href: '/admin/trash', label: t.navTrash },
    { href: '/admin/settings', label: t.navSettings },
    { href: '/admin/log', label: t.navLog },
  ]

  const isActive = (href: string): boolean =>
    href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(`${href}/`)

  const navItems = (
    <>
      {links.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          onClick={close}
          aria-current={isActive(l.href) ? 'page' : undefined}
          className={`${SIDEBAR_NAV} ${isActive(l.href) ? SIDEBAR_NAV_ACTIVE : ''}`}
        >
          {l.label}
        </Link>
      ))}
      <a href="/" target="_blank" rel="noopener" className={SIDEBAR_NAV} onClick={close}>
        {t.navViewBlog}
      </a>
    </>
  )

  const controls = (
    <>
      <PaletteToggle lang={lang} palettes={palettes} defaultId={defaultPalette} variant="text" triggerClassName={SIDEBAR_NAV} label={t.navAppearance} />
      <ThemeToggle lang={lang} variant="text" triggerClassName={SIDEBAR_NAV} />
      <CacheButton className={SIDEBAR_NAV} />
      <form action={signOut} className="contents">
        <button className={SIDEBAR_NAV}>{t.signOut}</button>
      </form>
    </>
  )

  const brand = (
    <Link href="/admin" onClick={close} className="flex h-9 items-center px-3 text-xl leading-none tracking-tight">
      vibe<span className="font-bold">blog</span>
    </Link>
  )

  return (
    <>
      {/* Desktop: sticky full-height left column */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white px-3 py-4 md:flex dark:border-neutral-800 dark:bg-neutral-900">
        {brand}
        <nav className="mt-4 flex flex-col gap-1">{navItems}</nav>
        <div className="mt-auto flex flex-col gap-1 border-t border-neutral-200 pt-3 dark:border-neutral-800">{controls}</div>
      </aside>

      {/* Mobile: top bar + drawer */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:hidden dark:border-neutral-800 dark:bg-neutral-900">
        {brand}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
          aria-label={t.navHome}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </header>
      {open && (
        <nav className="flex flex-col gap-1 border-b border-neutral-200 bg-white px-3 py-3 md:hidden dark:border-neutral-800 dark:bg-neutral-900">
          {navItems}
          <span className="my-1 h-px w-full bg-neutral-200 dark:bg-neutral-700" aria-hidden />
          {controls}
        </nav>
      )}
    </>
  )
}
