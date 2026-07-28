// Admin shell + auth guard. Only the owner reaches the children.
// - Not signed in        -> sign-in.
// - Signed in, not owner  -> silently sent home (no error shown).
// Admin-only stylesheet: Tailwind utilities scanned from the admin tree + admin
// chrome, kept out of the public bundle (public loads globals.css alone).
import './admin.css'
import { redirect } from 'next/navigation'
import { getAuthState, signOut } from '@/lib/auth'
import { getSettings } from '@/lib/settings'
import { AdminI18nProvider } from '@/components/admin/I18nProvider'
import { AdminSidebar } from '@/components/admin/AdminSidebar'
import { ToastProvider } from '@/components/ui/Toast'

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
      {/* Toasts are ADMIN-only (save/upload feedback) — the provider lives here, not in the
          root layout, so public pages never load its JS. */}
      <ToastProvider>
        <div className="admin-shell min-h-screen bg-neutral-100 md:flex dark:bg-neutral-950">
          <AdminSidebar lang={language} signOut={signOutAction} />
          {/* Main column right of the sidebar. Full browser width (admin is column-based
              now); ~100px gutters on desktop, tight padding on mobile. The dotted-grid
              canvas sits behind the floating cards (admin-canvas in admin.css). */}
          <main className="admin-canvas min-w-0 flex-1">
            <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 xl:px-12">{children}</div>
          </main>
        </div>
      </ToastProvider>
    </AdminI18nProvider>
  )
}
