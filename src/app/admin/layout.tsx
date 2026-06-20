// Admin shell + auth guard. Only the owner reaches the children.
// - Not signed in        -> sign-in.
// - Signed in, not owner  -> silently sent home (no error shown).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthState, signOut } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { AdminI18nProvider } from '@/components/admin/I18nProvider'
import { CacheButton } from '@/components/admin/CacheButton'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import pkg from '../../../package.json'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email, authorized } = await getAuthState()

  // Not signed in -> sign-in (returns to /admin afterwards).
  if (!email) redirect('/api/auth/signin?callbackUrl=%2Fadmin')
  // Signed in but not the owner -> silently sent home (no error shown).
  if (!authorized) redirect('/')

  const { language } = await getSettings()
  const t = adminT(language)
  // Wider admin shell so the editor's writing column can match the public
  // single-post width with room to spare for the settings panel.
  const shell = 'mx-auto max-w-7xl px-6'

  return (
    <AdminI18nProvider lang={language}>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className={`${shell} flex items-center justify-between gap-4 py-3`}>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/admin" className="font-bold">
                {t.navAdmin}
              </Link>
              <Link href="/admin/content" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navDashboard}
              </Link>
              <Link href="/admin/media" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navMedia}
              </Link>
              <Link href="/admin/settings" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navSettings}
              </Link>
              <a href="/" target="_blank" rel="noopener" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navViewBlog}
              </a>
            </nav>
            <div className="flex items-center gap-1">
              <ThemeToggle lang={language} />
              <CacheButton />
              <form
                className="flex"
                action={async () => {
                  'use server'
                  await signOut({ redirectTo: '/' })
                }}
              >
                <button className="flex h-10 items-center rounded-lg px-3 text-sm text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-white">{t.signOut}</button>
              </form>
            </div>
          </div>
        </header>
        <div className={`${shell} py-8`}>{children}</div>
        <footer className={`${shell} py-4 text-xs text-neutral-400 dark:text-neutral-600`}>
          vibeblog v{pkg.version} ·{' '}
          <a
            href="https://github.com/joiha-steven/vibeblog/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-neutral-600 dark:hover:text-neutral-400"
          >
            changelog
          </a>
        </footer>
      </div>
    </AdminI18nProvider>
  )
}
