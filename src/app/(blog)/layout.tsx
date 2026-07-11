// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { enabledPaletteOptions } from '@/lib/themes'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { PaletteToggle } from '@/components/theme/PaletteToggle'
import { HeaderMenu } from '@/components/blog/HeaderMenu'
import { SearchTrigger } from '@/components/blog/SearchTrigger'
import { Track } from '@/components/blog/Track'
import { renderInlineMarkdown, expandFooterTokens } from '@/lib/inline-md'

// Rail geometry, mirrored from globals.css (--rail-w / --rail-gap). A media query
// cannot read a CSS variable, so the breakpoint is computed here from the owner's
// contentWidth: the rail only appears once BOTH gutters can hold it, which keeps
// the reading column exactly centred at every width.
const RAIL_W = 180
const RAIL_GAP = 72 // mirrors --rail-gap
const RAIL_PAD = 14 // mirrors --rail-pad
const RAIL_BREATHING = 16 // clear space between the rail and the viewport edge
// Breakpoint = contentWidth + 2*(RAIL_W+RAIL_GAP+RAIL_BREATHING). At contentWidth
// 720 that is ~1256px, so common 1280/1366 laptops show the rail (not just the
// >=1344 it needed before), while narrower screens keep the drawer.

// Wide enough for a gutter: promote the drawer into the rail, strip every drawer
// affordance (fixed position, surface, border, transform, handle, scrim), and
// turn the rail around to face the column — text ranged right, accent marker on
// the right, and a hairline centred in the whitespace BETWEEN the two text edges
// (not between the two boxes, which would sit `--rail-pad` off centre).
function railCss(contentWidth: number): string {
  const at = contentWidth + 2 * (RAIL_W + RAIL_GAP + RAIL_BREATHING)
  const divider = (RAIL_GAP - RAIL_PAD) / 2
  return (
    `@media (min-width:${at}px){` +
    `.rail{position:absolute;inset:auto auto auto auto;top:var(--rail-top);` +
    `right:calc(100% + var(--rail-gap));left:auto;width:var(--rail-w);` +
    `height:calc(100% - var(--rail-top));padding:0;background:none;border:0;` +
    `overflow:visible;transform:none;text-align:right}` +
    `.rail::after{content:"";position:absolute;top:0;bottom:0;` +
    `right:-${divider}px;width:1px;background:var(--c-rule)}` +
    `.rail h2,.rail .rail-tags{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail .rail-tags{justify-content:flex-end}` +
    `.rail li a{justify-content:flex-end}` +
    `.rail-row{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail-row[aria-current]::before{left:auto;right:0}` +
    `.rail-handle,.rail-scrim{display:none}}`
  )
}

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const showLogo = settings.showLogo && settings.logoUrl
  // Owner-authored footer: expand {year}/{title}, then render the limited inline
  // markdown (escape-first, so it can never inject unsafe markup).
  const footerHtml = renderInlineMarkdown(expandFooterTokens(settings.footer, settings.title))
  return (
    <div
      className={`mx-auto flex min-h-screen w-full flex-col px-8 sm:px-5${settings.features.bookText ? ' book-text' : ''}`}
      style={{ maxWidth: settings.contentWidth }}
    >
      <style dangerouslySetInnerHTML={{ __html: railCss(settings.contentWidth) }} />
      {/* Owner CSS, public pages only (admin is never touched). Sanitized in settings.ts. */}
      {settings.customCss && <style dangerouslySetInnerHTML={{ __html: settings.customCss }} />}
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
        {/* Positioning context for the rail: it wraps the content, not the header,
            so the rail's first line lands level with the content's first line. */}
        <div className="with-rail flex flex-1 flex-col">
          <main className="flex-1 pt-12 pb-4">{children}</main>
        </div>
      <footer
        className="site-footer py-12 text-center t-small text-meta"
        dangerouslySetInnerHTML={{ __html: footerHtml }}
      />
    </div>
  )
}
