// Admin shell + auth guard. Only the owner reaches the children.
// - Not signed in        -> sign-in.
// - Signed in, not owner  -> silently sent home (no error shown).
import { redirect } from 'next/navigation'
import { getAuthState, signOut } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { AdminI18nProvider } from '@/components/admin/I18nProvider'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

// The entire admin is uncached — every view reads the CURRENT DB, so it never shows
// a stale snapshot (your own edits, or out-of-band changes like MCP/OAuth tokens,
// analytics, or a cron backup). NOTE: `dynamic = 'force-dynamic'` alone is NOT enough:
// our db() GET reads opt into the Data Cache with an explicit `next.revalidate`+tag,
// and force-dynamic only de-caches fetches that set NO revalidate (see Next's
// `noFetchConfigAndForceDynamic` in patch-fetch). `fetchCache = 'force-no-store'` is the
// lever that forces EVERY fetch in this segment to no-store regardless of its options;
// it cascades to all /admin children. (Public pages keep their cached reads — they set
// neither config.)
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

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
        <AdminSidebar lang={language} signOut={signOutAction} />
        {/* Main column right of the sidebar. Full browser width (admin is column-based
            now); ~100px gutters on desktop, tight padding on mobile. The dotted-grid
            canvas sits behind the floating cards (admin-canvas in globals.css). */}
        <main className="admin-canvas min-w-0 flex-1">
          <div className="w-full px-4 py-6 sm:px-6 lg:px-[100px] lg:py-8">{children}</div>
        </main>
      </div>
    </AdminI18nProvider>
  )
}
