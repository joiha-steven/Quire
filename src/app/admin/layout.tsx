// Admin shell + auth guard. Only the owner reaches the children.
// - Not signed in        -> GitHub sign-in.
// - Signed in, not owner  -> silently sent home (no error shown).
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getAuthState, signOut } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { email, authorized } = await getAuthState()

  // Not signed in -> GitHub sign-in (returns to /admin afterwards).
  if (!email) redirect('/api/auth/signin?callbackUrl=%2Fadmin')
  // Signed in but not the owner -> silently sent home (no error shown).
  if (!authorized) redirect('/')

  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
          <nav className="flex items-center gap-5 text-sm">
            <Link href="/admin" className="font-bold">
              Quản trị
            </Link>
            <Link href="/admin" className="text-neutral-600 hover:text-neutral-900">
              Bảng điều khiển
            </Link>
            <Link href="/admin/media" className="text-neutral-600 hover:text-neutral-900">
              Thư viện ảnh
            </Link>
            <Link href="/" className="text-neutral-600 hover:text-neutral-900">
              Xem blog
            </Link>
          </nav>
          <form
            action={async () => {
              'use server'
              await signOut({ redirectTo: '/' })
            }}
          >
            <button className="text-sm text-neutral-500 hover:text-neutral-900">Đăng xuất</button>
          </form>
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-5 py-8">{children}</div>
    </div>
  )
}
