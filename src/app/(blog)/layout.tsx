// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { enabledPaletteOptions } from '@/lib/themes'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { PaletteToggle } from '@/components/theme/PaletteToggle'
import { HeaderMenu } from '@/components/blog/HeaderMenu'
import { SearchTrigger } from '@/components/blog/SearchTrigger'
import { Track } from '@/components/blog/Track'

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
              // runtime, but next/image's optimizer only allows hosts whitelisted in
              // next.config at BUILD time — a runtime host would 400. A plain tag loads
              // from whatever host the setting yields, no build coupling. We serve the
              // DERIVED logo (logoRenderUrl: a small WebP rendered to logoWidth @2x for
              // retina, built on save) when present, falling back to the original for
              // vector/animated logos. width + height attrs reserve space (no CLS);
              // the CSS width keeps it responsive, height:auto keeps the ratio.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={settings.logoRenderUrl || settings.logoUrl}
                alt={settings.title}
                width={settings.logoWidth}
                height={settings.logoRenderHeight || undefined}
                style={{ width: settings.logoWidth, height: 'auto' }}
                fetchPriority="high"
                decoding="async"
              />
            ) : (
              <span className="text-lg font-bold tracking-tight">{settings.title}</span>
            )}
          </Link>
          <div className="flex shrink-0 items-center gap-0.5">
            {settings.features.search && <SearchTrigger lang={settings.language} />}
            <PaletteToggle lang={settings.language} palettes={enabledPaletteOptions(settings.themes, settings.enabledPalettes)} defaultId={settings.themePreset} />
            <ThemeToggle lang={settings.language} />
            <HeaderMenu items={settings.menu} lang={settings.language} />
          </div>
        </div>
        {settings.showDescription && settings.description && (
          <p className="mt-3 t-small text-meta">{settings.description}</p>
        )}
      </header>
      <Track />
      <main className="flex-1 py-4">{children}</main>
      <footer className="py-12 text-center t-small text-meta">
        © {new Date().getFullYear()} {settings.title} ·{' '}
        <a href={REPO_URL} target="_blank" rel="noopener" className="hover:text-text">
          powered by vibeblog
        </a>
      </footer>
    </div>
  )
}
