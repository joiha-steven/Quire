// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { paletteOptions } from '@/lib/themes'
import { t } from '@/lib/i18n'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { PaletteToggle } from '@/components/theme/PaletteToggle'
import { HeaderMenu } from '@/components/blog/HeaderMenu'
import { ICON_BTN } from '@/components/ui/iconButton'

const REPO_URL = 'https://github.com/joiha-steven/vibeblog'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const showLogo = settings.showLogo && settings.logoUrl
  return (
    <div
      className="mx-auto flex min-h-screen w-full flex-col px-5"
      style={{ maxWidth: settings.contentWidth }}
    >
      {/* Owner CSS, public pages only (admin is never touched). Sanitized in settings.ts. */}
      {settings.customCss && <style dangerouslySetInnerHTML={{ __html: settings.customCss }} />}
      <header className="py-7">
        {/* Logo and the icon row share ONE flex line so the icons stay centered
            on the logo's vertical midline at any logo size. The description sits
            below the whole row. */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex items-center">
            {showLogo ? (
              // Plain <img>, NOT next/image: the logo host is owner-configurable at
              // runtime (Settings → Media domain), but next/image's optimizer only
              // allows hosts whitelisted in next.config at BUILD time — a runtime
              // vanity domain would 400. A plain tag loads from whatever host the
              // setting yields, no build coupling. Logos are small + CDN-cached, so
              // skipping optimization is negligible. height:auto keeps the ratio.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoUrl}
                alt={settings.title}
                width={settings.logoWidth}
                style={{ width: settings.logoWidth, height: 'auto' }}
                fetchPriority="high"
                decoding="async"
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
                className={ICON_BTN}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </Link>
            )}
            <PaletteToggle lang={settings.language} palettes={paletteOptions(settings.themes)} defaultId={settings.themePreset} />
            <ThemeToggle lang={settings.language} />
            <HeaderMenu items={settings.menu} lang={settings.language} />
          </div>
        </div>
        {settings.showDescription && settings.description && (
          <p className="mt-3 text-sm text-meta">{settings.description}</p>
        )}
      </header>
      <main className="flex-1 py-4">{children}</main>
      <footer className="py-12 text-center text-sm text-meta">
        © {new Date().getFullYear()} {settings.title} ·{' '}
        <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-text">
          powered by vibeblog
        </a>
      </footer>
    </div>
  )
}
