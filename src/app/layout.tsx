import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getSettings, themesToCss, typographyToCss, fontToCss, getDefaultTheme, resolveSiteUrl, resolveAppIcon } from '@/lib/settings'
import { fontPresetCss, fontPreloadHrefs, chromeFontCss } from '@/lib/themes'

// Before paint: apply saved mode + palette to avoid a wrong-color flash. Default
// palette is baked into :root, so only set data-palette when a stored palette is
// still ENABLED — a palette the owner has since hidden falls back to the default.
function noFouc(enabled: string[], gridView: boolean): string {
  return `(function(){try{var d=document.documentElement;var m=localStorage.getItem('theme')||'system';var dk=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)||(m==='time'&&(function(){var h=new Date().getHours();return h>=18||h<6})());if(dk)d.classList.add('dark');var p=localStorage.getItem('palette');if(p&&${JSON.stringify(enabled)}.indexOf(p)>-1)d.setAttribute('data-palette',p);if(${gridView}&&localStorage.getItem('list')==='grid')d.setAttribute('data-list','grid')}catch(e){}})();`
}


export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  const { title, description } = settings
  return {
    metadataBase: new URL(resolveSiteUrl(settings)),
    title: { default: title, template: `%s · ${title}` },
    description: description || undefined,
    // ONE favicon, driven only here. Default lives in public/ NOT app/ — an
    // app/favicon.ico is auto-injected ON TOP of this, shipping two conflicting
    // icons. `apple` = the iOS Add-to-Home-Screen icon (ignores the manifest).
    icons: {
      icon: settings.faviconUrl || '/favicon.ico',
      apple: resolveAppIcon(settings),
    },
    appleWebApp: { capable: true, title, statusBarStyle: 'default' },
    alternates: settings.seo.rss ? { types: { 'application/rss+xml': '/feed.xml' } } : undefined,
  }
}

// Status-bar color follows the chosen palette per light/dark.
export async function generateViewport(): Promise<Viewport> {
  const { themes, themePreset } = await getSettings()
  const theme = getDefaultTheme(themes, themePreset)
  return {
    // Extend the page under the notch / Dynamic Island so a fixed top bar (the
    // reading progress) sits flush at the true screen edge; `body` re-pads the
    // content past the safe area (globals.css) so the header never tucks under it.
    viewportFit: 'cover',
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: theme.light.bg },
      { media: '(prefers-color-scheme: dark)', color: theme.dark.bg },
    ],
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language, themes, themePreset, fontPreset, chromeFont, enabledPalettes, typography, customFont, motion, features } = await getSettings()
  // No `antialiased` on <html>: it forces grayscale smoothing on Mac, thinning body text.
  // data-motion is server-rendered from settings (site-wide), so the motion engine
  // is on/off at first paint — no flash, no client JS. CSS also forces it off under
  // prefers-reduced-motion. All durations collapse to 0s when off (globals.css).
  return (
    <html lang={language} data-motion={motion.enabled ? 'on' : 'off'} data-chrome-font={chromeFont} className="h-full">
      <body className="min-h-full">
        {/* Preload ONLY the CHOSEN reading font's subsets that the LCP text (the post
            title) needs — latin, plus vietnamese on a vi site. The chrome font (header/
            meta/rail) is deliberately NOT preloaded: it is not the LCP element, so it
            loads at normal priority via its @font-face and swaps in, leaving the critical
            path (CSS + the LCP font) uncontended. */}
        {fontPreloadHrefs(fontPreset, language, Boolean(customFont.family && customFont.faces.length)).map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="anonymous" />
        ))}
        {/* All palettes' colors as CSS vars; client swaps via <html data-palette>. */}
        <style dangerouslySetInnerHTML={{ __html: themesToCss(themes, themePreset) }} />
        {/* Owner type scale → fs/lh/ls vars, then the reading font (--font-reading:
            chosen built-in, then any uploaded custom font which wins). The chrome font
            comes LAST so it can point --font-sans at the resolved reading font ('reading')
            or at IBM Plex Mono ('plex-mono'); 'inter' emits nothing (globals baseline). */}
        <style dangerouslySetInnerHTML={{ __html:
          typographyToCss(typography) + fontPresetCss(fontPreset) + fontToCss(customFont) +
          chromeFontCss(chromeFont) }} />
        <script dangerouslySetInnerHTML={{ __html: noFouc(enabledPalettes, features.gridView) }} />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
