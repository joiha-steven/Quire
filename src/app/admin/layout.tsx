// Admin shell + auth guard. Only the owner reaches the children.
// - Not signed in        -> sign-in.
// - Signed in, not owner  -> silently sent home (no error shown).
import { redirect } from 'next/navigation'
import { getAuthState, signOut } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { paletteOptions } from '@/lib/themes'
import { AdminI18nProvider } from '@/components/admin/I18nProvider'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

// The entire admin is uncached — every view reads the current Blob state, so the
// editor/media library/settings never show a stale snapshot of your own edits.
export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email, authorized } = await getAuthState()

  // Not signed in -> sign-in (returns to /admin afterwards).
  if (!email) redirect('/api/auth/signin?callbackUrl=%2Fadmin')
  // Signed in but not the owner -> silently sent home (no error shown).
  if (!authorized) redirect('/')

  const settings = await getSettings()
  const { language } = settings

  // Server action passed to the client header (sign-out button / form).
  async function signOutAction() {
    'use server'
    await signOut({ redirectTo: '/' })
  }

  return (
    <AdminI18nProvider lang={language}>
      <div className="min-h-screen bg-neutral-50 md:flex dark:bg-neutral-950">
        <AdminSidebar
          lang={language}
          signOut={signOutAction}
          palettes={paletteOptions(settings.themes)}
          defaultPalette={settings.themePreset}
        />
        {/* Main column to the right of the sidebar. Wide enough for the editor's
            writing column + the settings panel. */}
        <main className="min-w-0 flex-1">
          <div className="mx-auto max-w-6xl px-6 py-8">{children}</div>
        </main>
      </div>
    </AdminI18nProvider>
  )
}
