// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import Image from 'next/image'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { HeaderMenu } from '@/components/blog/HeaderMenu'

const REPO_URL = 'https://github.com/joiha-steven/vibeblog'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const showLogo = settings.showLogo && settings.logoUrl
  return (
    <div
      className="mx-auto flex min-h-screen w-full flex-col px-5"
      style={{ maxWidth: settings.contentWidth }}
    >
      <header className="py-7">
        {/* Logo and the icon row share ONE flex line so the icons stay centered
            on the logo's vertical midline at any logo size. The description sits
            below the whole row. */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            {showLogo ? (
              // next/image resizes the logo to its display width (the uploaded
              // file can be up to 1600px). width/height 0 + sizes lets it work
              // without knowing the logo's intrinsic ratio.
              <Image
                src={settings.logoUrl}
                alt={settings.title}
                width={0}
                height={0}
                sizes={`${settings.logoWidth}px`}
                style={{ width: settings.logoWidth, height: 'auto' }}
                priority
              />
            ) : (
              <span className="text-lg font-bold tracking-tight">{settings.title}</span>
            )}
          </Link>
          <div className="flex shrink-0 items-center gap-0.5">
            {settings.features.search && (
              <Link
                href="/search"
                aria-label={t(settings.language).search}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </Link>
            )}
            <ThemeToggle lang={settings.language} />
            <HeaderMenu items={settings.menu} lang={settings.language} />
          </div>
        </div>
        {settings.showDescription && settings.description && (
          <p className="mt-3 text-sm text-neutral-500 dark:text-neutral-400">{settings.description}</p>
        )}
      </header>
      <main className="flex-1 py-4">{children}</main>
      <footer className="py-12 text-center text-sm text-neutral-400 dark:text-neutral-500">
        © {new Date().getFullYear()} {settings.title} ·{' '}
        <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-neutral-600 dark:hover:text-neutral-300">
          powered by vibeblog
        </a>
      </footer>
    </div>
  )
}
