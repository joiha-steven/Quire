// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'

const REPO_URL = 'https://github.com/joiha-steven/vibeblog'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const showLogo = settings.showLogo && settings.logoUrl
  return (
    <div
      className="mx-auto flex min-h-screen w-full flex-col px-5"
      style={{ maxWidth: settings.contentWidth }}
    >
      <header className="py-8">
        <Link href="/" className="inline-flex items-center gap-3">
          {showLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.logoUrl} alt={settings.title} style={{ width: settings.logoWidth }} className="h-auto" />
          ) : (
            <span className="text-lg font-bold tracking-tight">{settings.title}</span>
          )}
        </Link>
        {settings.showDescription && settings.description && (
          <p className="mt-2 text-sm text-neutral-500">{settings.description}</p>
        )}
      </header>
      <main className="flex-1 py-4">{children}</main>
      <footer className="py-10 text-center text-sm text-neutral-400">
        © {new Date().getFullYear()} {settings.title} ·{' '}
        <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-neutral-600">
          powered by vibeblog
        </a>
      </footer>
    </div>
  )
}
