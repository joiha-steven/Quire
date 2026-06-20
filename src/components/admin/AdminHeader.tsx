'use client'

// Admin top bar. One uniform row of TEXT links — brand wordmark + nav + theme /
// clear-cache / sign-out, all sharing ADMIN_NAV so nothing reads as a button and
// the cluster can't drift. Desktop shows it inline; mobile collapses everything
// behind a hamburger that toggles the same items stacked. Rendered inside
// AdminI18nProvider, so it can read labels via useAdminT().
import Link from 'next/link'
import { useState } from 'react'
import type { SiteLang } from '@/types'
import { useAdminT } from './I18nProvider'
import { ADMIN_NAV } from './headerActions'
import { CacheButton } from './CacheButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'

export function AdminHeader({ lang, signOut }: { lang: SiteLang; signOut: () => Promise<void> }) {
  const t = useAdminT()
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  const links = [
    { href: '/admin', label: t.navHome },
    { href: '/admin/content', label: t.navDashboard },
    { href: '/admin/media', label: t.navMedia },
    { href: '/admin/settings', label: t.navSettings },
  ]

  // Nav links + "view blog" (shared by desktop row and mobile panel).
  const navItems = (
    <>
      {links.map((l) => (
        <Link key={l.href} href={l.href} className={ADMIN_NAV} onClick={close}>
          {l.label}
        </Link>
      ))}
      <a href="/" target="_blank" rel="noopener" className={ADMIN_NAV} onClick={close}>
        {t.navViewBlog}
      </a>
    </>
  )

  // Theme / cache / sign-out (shared by desktop row and mobile panel).
  const controls = (
    <>
      <ThemeToggle lang={lang} variant="text" triggerClassName={ADMIN_NAV} />
      <CacheButton />
      <form action={signOut} className="contents">
        <button className={ADMIN_NAV}>{t.signOut}</button>
      </form>
    </>
  )

  return (
    <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-3">
        {/* Left: brand wordmark (logo) + nav menu. The wordmark is the SAME h-9
            items-center box as every nav link, so its text sits on the exact same
            line — see the "admin header alignment" rule in CLAUDE.md. */}
        <div className="flex items-center gap-5">
          <Link href="/admin" className="inline-flex h-9 items-center text-xl leading-none tracking-tight" onClick={close}>
            vibe<span className="font-bold">blog</span>
          </Link>
          <nav className="hidden items-center gap-5 md:flex">{navItems}</nav>
        </div>

        {/* Right: controls (desktop) — same text styling as the menu */}
        <div className="hidden items-center gap-5 md:flex">{controls}</div>

        {/* Mobile: hamburger toggle */}
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 md:hidden dark:text-neutral-300 dark:hover:bg-neutral-800"
          aria-label={t.navHome}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* Mobile panel */}
      {open && (
        <nav className="flex flex-col gap-3 border-t border-neutral-200 px-6 py-4 md:hidden dark:border-neutral-800">
          {navItems}
          <span className="h-px w-full bg-neutral-200 dark:bg-neutral-700" aria-hidden />
          <div className="flex items-center gap-5">{controls}</div>
        </nav>
      )}
    </header>
  )
}
