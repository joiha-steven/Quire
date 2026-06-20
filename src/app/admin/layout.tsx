// Admin shell + auth guard. Only the owner reaches the children.
// - Not signed in        -> sign-in.
// - Signed in, not owner  -> silently sent home (no error shown).
import { redirect } from 'next/navigation'
import { getAuthState, signOut } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { AdminI18nProvider } from '@/components/admin/I18nProvider'
import { AdminHeader } from '@/components/admin/AdminHeader'

// The entire admin is uncached — every view reads the current Blob state, so the
// editor/media library/settings never show a stale snapshot of your own edits.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email, authorized } = await getAuthState()

  // Not signed in -> sign-in (returns to /admin afterwards).
  if (!email) redirect('/api/auth/signin?callbackUrl=%2Fadmin')
  // Signed in but not the owner -> silently sent home (no error shown).
  if (!authorized) redirect('/')

  const { language } = await getSettings()

  // Server action passed to the client header (sign-out button / form).
  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <AdminI18nProvider lang={language}>
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
        <AdminHeader lang={language} signOut={signOutAction} />
        {/* Wider admin shell so the editor's writing column can match the public
            single-post width with room to spare for the settings panel. */}
        <div className="mx-auto max-w-7xl px-6 py-8">{children}</div>
      </div>
    </AdminI18nProvider>
  )
}
