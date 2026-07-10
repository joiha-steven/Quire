// Public blog shell: header (from site settings) + content column + footer.
import Link from 'next/link'
import { getSettings } from '@/lib/settings'
import { getPublicTaxonomy } from '@/lib/posts'
import { termSlug } from '@/lib/taxonomy'
import { enabledPaletteOptions } from '@/lib/themes'
import { t } from '@/lib/i18n'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { PaletteToggle } from '@/components/theme/PaletteToggle'
import { HeaderMenu } from '@/components/blog/HeaderMenu'
import { MenuProvider } from '@/components/blog/MenuContext'
import { SideIndex } from '@/components/blog/SideIndex'
import { SearchTrigger } from '@/components/blog/SearchTrigger'
import { Track } from '@/components/blog/Track'
import { renderInlineMarkdown, expandFooterTokens } from '@/lib/inline-md'

// Rail geometry, mirrored from globals.css (--rail-w / --rail-gap). A media query
// cannot read a CSS variable, so the breakpoint is computed here from the owner's
// contentWidth: the rail only appears once BOTH gutters can hold it, which keeps
// the reading column exactly centred at every width.
const RAIL_W = 200
const RAIL_GAP = 60
const RAIL_BREATHING = 40 // clear space between the rail and the viewport edge

function railCss(contentWidth: number): string {
  const at = contentWidth + 2 * (RAIL_W + RAIL_GAP + RAIL_BREATHING)
  return (
    `@media (min-width:${at}px){` +
    `.rail{display:block;position:absolute;top:var(--rail-top);` +
    `right:calc(100% + var(--rail-gap));width:var(--rail-w);height:calc(100% - var(--rail-top))}` +
    `.rail-hidden{display:none}}`
  )
}

export default async function BlogLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSettings()
  const showLogo = settings.showLogo && settings.logoUrl
  const labels = t(settings.language)
  // Categories + tags for the header menu (the narrow-screen home of the sidebar).
  // The rail renders its own copy; both read the same helper, so they agree.
  const taxonomy = settings.features.sidebar ? await getPublicTaxonomy() : null
  const index = taxonomy ? (
    <SideIndex
      categoriesTitle={labels.categoriesTitle}
      tagsTitle={labels.tagsTitle}
      categories={taxonomy.categories.map((c) => ({ href: `/category/${termSlug(c.name)}`, label: c.name, count: c.count }))}
      tags={taxonomy.tags.map((tag) => ({ href: `/tag/${termSlug(tag.name)}`, label: tag.name }))}
    />
  ) : null
  // Owner-authored footer: expand {year}/{title}, then render the limited inline
  // markdown (escape-first, so it can never inject unsafe markup).
  const footerHtml = renderInlineMarkdown(expandFooterTokens(settings.footer, settings.title))
  return (
    <div
      className="mx-auto flex min-h-screen w-full flex-col px-8 sm:px-5"
      style={{ maxWidth: settings.contentWidth }}
    >
      <style dangerouslySetInnerHTML={{ __html: railCss(settings.contentWidth) }} />
      {/* Owner CSS, public pages only (admin is never touched). Sanitized in settings.ts. */}
      {settings.customCss && <style dangerouslySetInnerHTML={{ __html: settings.customCss }} />}
      <MenuProvider>
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
              <HeaderMenu items={settings.menu} lang={settings.language} index={index} tocTitle={labels.tocIndex} />
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
      </MenuProvider>
      <footer
        className="site-footer py-12 text-center t-small text-meta"
        dangerouslySetInnerHTML={{ __html: footerHtml }}
      />
    </div>
  )
}
