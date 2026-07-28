// The admin application: the shell the frozen tree's `/admin/layout.tsx` was, plus the
// route table its directory structure was.
//
// The auth guard is NOT here. The server refuses to serve this bundle's HTML to anyone who
// is not the owner, which is the same gate every write route sits behind (Invariant 4) — a
// check in the client would be decoration.

import { Suspense, lazy, type ReactNode } from 'react'
import { RouterProvider, usePathname } from '@/admin/router'
import { useView } from '@/admin/useView'
import { AdminI18nProvider } from '@/admin/components/I18nProvider'
import { ToastProvider } from '@/admin/ui/Toast'
import { ThemeProvider } from '@/admin/ui/ThemeProvider'
import { AdminSidebar } from '@/admin/components/AdminSidebar'
import type { SiteLang } from '@/types'

// The editor pulls in Tiptap and its extensions, which is most of the bundle. Splitting it
// out means the dashboard, the settings and every table load without paying for an editor
// nobody has opened.
const Dashboard = lazy(() => import('@/admin/pages/Dashboard'))
const Content = lazy(() => import('@/admin/pages/Content'))
const PostEditor = lazy(() => import('@/admin/pages/PostEditor'))
const PageEditor = lazy(() => import('@/admin/pages/PageEditor'))
const Media = lazy(() => import('@/admin/pages/Media'))
const Comments = lazy(() => import('@/admin/pages/Comments'))
const Newsletter = lazy(() => import('@/admin/pages/Newsletter'))
const Analytics = lazy(() => import('@/admin/pages/Analytics'))
const Log = lazy(() => import('@/admin/pages/Log'))
const Trash = lazy(() => import('@/admin/pages/Trash'))
const Settings = lazy(() => import('@/admin/pages/Settings'))
const Help = lazy(() => import('@/admin/pages/Help'))
const NotFound = lazy(() => import('@/admin/pages/NotFound'))

/**
 * The route table. Order matters only in that the longest prefix has to be tested first,
 * which is why this is a list and not an object.
 */
function Route(): ReactNode {
  const path = usePathname().replace(/\/+$/, '') || '/admin'
  if (path === '/admin') return <Dashboard />
  if (path === '/admin/content') return <Content />
  if (path === '/admin/editor' || path.startsWith('/admin/editor/')) return <PostEditor />
  if (path === '/admin/page-editor' || path.startsWith('/admin/page-editor/')) return <PageEditor />
  if (path === '/admin/media') return <Media />
  if (path === '/admin/comments') return <Comments />
  if (path === '/admin/newsletter') return <Newsletter />
  if (path === '/admin/analytics') return <Analytics />
  if (path === '/admin/log') return <Log />
  if (path === '/admin/trash') return <Trash />
  if (path === '/admin/settings') return <Settings />
  if (path === '/admin/help') return <Help />
  return <NotFound />
}

/** The editor takes the whole width; every other page sits in the padded canvas. */
function Canvas({ children }: { children: ReactNode }) {
  const path = usePathname()
  const editing = path.startsWith('/admin/editor') || path.startsWith('/admin/page-editor')
  return (
    <main className="admin-canvas min-w-0 flex-1">
      {editing
        ? children
        : <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-7 lg:px-10 lg:py-9 xl:px-12">{children}</div>}
    </main>
  )
}

async function signOut(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
  location.href = '/'
}

function Shell() {
  // One round trip before anything renders, for the two facts the whole shell needs. The
  // frozen tree read them in the layout's server component; there is nowhere else to put
  // them now, and a language flash is worse than a blank frame.
  const { data } = useView<{ language: SiteLang; version: string }>('shell')
  if (!data) return <div className="min-h-screen bg-neutral-100 dark:bg-neutral-950" />
  return (
    <AdminI18nProvider lang={data.language}>
      {/* Toasts are ADMIN-only (save and upload feedback), so the provider lives here. */}
      <ToastProvider>
        <div className="admin-shell min-h-screen bg-neutral-100 md:flex dark:bg-neutral-950">
          <AdminSidebar lang={data.language} signOut={signOut} />
          <Canvas>
            <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-400">…</div>}>
              <Route />
            </Suspense>
          </Canvas>
        </div>
      </ToastProvider>
    </AdminI18nProvider>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider>
        <Shell />
      </RouterProvider>
    </ThemeProvider>
  )
}
