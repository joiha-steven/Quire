// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { enabledPaletteOptions } from '@/lib/themes'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { PaletteToggle } from '@/components/theme/PaletteToggle'
import { RailToggle } from '@/components/blog/RailToggle'
import { GridToggle } from '@/components/blog/GridToggle'
import { SearchTrigger } from '@/components/blog/SearchTrigger'
import { Track } from '@/components/blog/Track'
import { renderInlineMarkdown, expandFooterTokens } from '@/lib/inline-md'
import { singleRailCss } from '@/lib/rail-css'
import { t } from '@/lib/i18n'

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const showLogo = settings.showLogo && settings.logoUrl
  // Owner-authored footer: expand {year}/{title}, then render the limited inline
  // markdown (escape-first, so it can never inject unsafe markup).
  const footerHtml = renderInlineMarkdown(expandFooterTokens(settings.footer, settings.title), { newTab: true })
  // Only load the palette switcher (a client island) when there's more than one palette to
  // switch between — otherwise its JS is dead weight.
  const palettes = enabledPaletteOptions(settings.themes, settings.enabledPalettes)
  return (
    <div
      className={`mx-auto flex min-h-screen w-full flex-col px-8 sm:px-5${settings.features.bookText ? ' book-text' : ''}`}
      // Column width via --shell-w so a listing page can narrow the whole shell (it emits a
      // smaller --shell-w); posts/other pages fall back to the owner's contentWidth.
      style={{ maxWidth: `var(--shell-w, ${settings.contentWidth}px)` }}
    >
      <style dangerouslySetInnerHTML={{ __html: singleRailCss(settings.contentWidth) }} />
      {/* Owner CSS, public pages only (admin is never touched). Sanitized in settings.ts. */}
      {settings.customCss && <style dangerouslySetInnerHTML={{ __html: settings.customCss }} />}
        {/* First focusable element: jump past the header controls to the content. */}
        <a href="#content" className="skip-link">{t(settings.language).skipToContent}</a>
        <header className="py-7">
          {/* Logo and the icon row share ONE flex line so the icons stay centered
              on the logo's vertical midline at any logo size. The description sits
              below the whole row. */}
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex cursor-pointer items-center">
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
                <span className="fs-h4 font-bold">{settings.title}</span>
              )}
            </Link>
            <div className="flex shrink-0 items-center gap-0.5">
              {settings.features.search && <SearchTrigger lang={settings.language} />}
              {palettes.length > 1 && <PaletteToggle lang={settings.language} palettes={palettes} defaultId={settings.themePreset} />}
              <ThemeToggle lang={settings.language} />
              {/* Grid/List switch for listing pages; self-hides on reading views. Gated by
                  the owner (features.gridView) — off keeps every listing a list. */}
              {settings.features.gridView && <GridToggle lang={settings.language} />}
              {/* Mobile-only: opens the sidebar drawer. Hidden above the rail breakpoint
                  (gutter rail) and self-hides on pages with no rail (see RailToggle). */}
              <RailToggle lang={settings.language} />
            </div>
          </div>
          {settings.showDescription && settings.description && (
            <p className="mt-3 t-small text-meta">{settings.description}</p>
          )}
        </header>
        <Track />
        {/* Positioning context for the rail: it wraps the content, not the header,
            so the rail's first line lands level with the content's first line. */}
        <div className="with-rail flex flex-1 flex-col">
          <main id="content" className="flex-1 pt-12 pb-4">{children}</main>
        </div>
      <footer
        className="site-footer py-12 text-center t-small text-meta"
        dangerouslySetInnerHTML={{ __html: footerHtml }}
      />
    </div>
  )
}
