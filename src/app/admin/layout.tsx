// Admin shell + auth guard. Only the owner reaches the children.
// - Not signed in        -> sign-in.
// - Signed in, not owner  -> silently sent home (no error shown).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthState, signOut } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { adminT } from '@/lib/admin-i18n'
import { AdminI18nProvider } from '@/components/admin/I18nProvider'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email, authorized } = await getAuthState()

  // Not signed in -> sign-in (returns to /admin afterwards).
  if (!email) redirect('/api/auth/signin?callbackUrl=%2Fadmin')
  // Signed in but not the owner -> silently sent home (no error shown).
  if (!authorized) redirect('/')

  const { language } = await getSettings()
  const t = adminT(language)

  return (
    <AdminI18nProvider lang={language}>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/admin" className="font-bold">
                {t.navAdmin}
              </Link>
              <Link href="/admin" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navDashboard}
              </Link>
              <Link href="/admin/media" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navMedia}
              </Link>
              <Link href="/admin/settings" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navSettings}
              </Link>
              <Link href="/" className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">
                {t.navViewBlog}
              </Link>
            </nav>
            <form
              action={async () => {
                'use server'
                await signOut({ redirectTo: '/' })
              }}
            >
              <button className="text-sm text-neutral-500 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-white">{t.signOut}</button>
            </form>
          </div>
        </header>
        <div className="mx-auto max-w-5xl px-5 py-8">{children}</div>
      </div>
    </AdminI18nProvider>
  )
}
