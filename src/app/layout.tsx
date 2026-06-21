import type { Metadata, Viewport } from 'next'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getSettings, themesToCss, typographyToCss, fontToCss, getDefaultTheme, resolveSiteUrl, resolveAppIcon } from '@/lib/settings'
import { blobOrigin } from '@/lib/blob'

// Runs before paint: applies the saved dark/light mode AND the saved palette
// (data-palette) so there is no flash of the wrong colors. The default palette
// is already baked into :root, so we only set data-palette when one is stored.
const NO_FOUC = `(function(){try{var d=document.documentElement;var m=localStorage.getItem('theme')||'system';var dk=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)||(m==='time'&&(function(){var h=new Date().getHours();return h>=18||h<6})());if(dk)d.classList.add('dark');var p=localStorage.getItem('palette');if(p)d.setAttribute('data-palette',p)}catch(e){}})();`


export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  const { title, description } = settings
  return {
    // Absolute base for canonical + OG/Twitter image URLs.
    metadataBase: new URL(resolveSiteUrl(settings)),
    title: { default: title, template: `%s · ${title}` },
    description: description || undefined,
    // Owner-set favicon overrides the bundled app/favicon.ico. `apple` is the
    // home-screen icon iOS uses on "Add to Home Screen" (it ignores the manifest).
    icons: {
      icon: settings.faviconUrl || undefined,
      apple: resolveAppIcon(settings),
    },
    // Standalone launch: Android reads the manifest's `display:standalone`; iOS
    // 16.4+ honours it too (so no legacy apple-prefixed meta is needed — Next
    // manages capability as the modern `mobile-web-app-capable`). `statusBarStyle`
    // + `title` still apply to the iOS home-screen launch.
    appleWebApp: { capable: true, title, statusBarStyle: 'default' },
    // Advertise the RSS feed so readers/aggregators can auto-discover it.
    alternates: settings.seo.rss ? { types: { 'application/rss+xml': '/feed.xml' } } : undefined,
  }
}

// Status-bar / toolbar color follows the chosen palette per light/dark, so the
// installed app's chrome blends into the page in both modes.
export async function generateViewport(): Promise<Viewport> {
  const { themes, themePreset } = await getSettings()
  const theme = getDefaultTheme(themes, themePreset)
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: theme.light.bg },
      { media: '(prefers-color-scheme: dark)', color: theme.dark.bg },
    ],
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language, themes, themePreset, typography, customFont } = await getSettings()
  // Content images in posts are raw Blob URLs; warm that connection early.
  const blob = blobOrigin()
  // No `antialiased` class on <html>: it forces grayscale font-smoothing on Mac,
  // which thins body text. Default smoothing keeps reading text at full weight.
  return (
    <html lang={language} className="h-full">
      <body className="min-h-full">
        {/* Preload the Latin Inter subset (the one almost every page needs) so the
            self-hosted face paints without a swap flash on first load. */}
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {blob && (
          <>
            <link rel="preconnect" href={blob} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={blob} />
          </>
        )}
        {/* All palettes' reading colors (light + dark) as CSS variables; the
            client switcher swaps between them via <html data-palette>. */}
        <style dangerouslySetInnerHTML={{ __html: themesToCss(themes, themePreset) }} />
        {/* Owner type scale + rhythm → --fs-*, --lh-body, --ls-body (overrides the
            globals.css defaults), plus the optional custom @font-face. */}
        <style dangerouslySetInnerHTML={{ __html: typographyToCss(typography) + fontToCss(customFont) }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC }} />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
