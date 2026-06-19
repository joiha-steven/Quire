// Public blog shell: header + centered content column + footer.
import Link from 'next/link'

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5">
      <header className="flex items-center justify-between py-8">
        <Link href="/" className="text-lg font-bold tracking-tight">
          vibeblog
        </Link>
      </header>
      <main className="flex-1 py-4">{children}</main>
      <footer className="py-10 text-sm text-neutral-400">
        © {new Date().getFullYear()} vibeblog
      </footer>
    </div>
  )
}
