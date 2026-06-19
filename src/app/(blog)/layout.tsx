// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const showLogo = settings.showLogo && settings.logoUrl
  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5">
      <header className="py-8">
        <Link href="/" className="inline-flex items-center gap-3">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={settings.title} className="h-8 w-auto" />
          ) : (
            <span className="text-lg font-bold tracking-tight">{settings.title}</span>
          )}
        </Link>
        {settings.showDescription && settings.description && (
          <p className="mt-2 text-sm text-neutral-500">{settings.description}</p>
        )}
      </header>
      <main className="flex-1 py-4">{children}</main>
      <footer className="py-10 text-sm text-neutral-400">
        © {new Date().getFullYear()} {settings.title}
      </footer>
    </div>
  )
}
