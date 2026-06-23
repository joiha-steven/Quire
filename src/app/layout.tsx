import type { Metadata, Viewport } from 'next'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getSettings, themesToCss, typographyToCss, fontToCss, getDefaultTheme, resolveSiteUrl, resolveAppIcon } from '@/lib/settings'
import { blobOrigin } from '@/lib/blob'

// Before paint: apply saved mode + palette to avoid a wrong-color flash. Default
// palette is baked into :root, so only set data-palette when a stored palette is
// still ENABLED — a palette the owner has since hidden falls back to the default.
function noFouc(enabled: string[]): string {
  return `(function(){try{var d=document.documentElement;var m=localStorage.getItem('theme')||'system';var dk=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)||(m==='time'&&(function(){var h=new Date().getHours();return h>=18||h<6})());if(dk)d.classList.add('dark');var p=localStorage.getItem('palette');if(p&&${JSON.stringify(enabled)}.indexOf(p)>-1)d.setAttribute('data-palette',p)}catch(e){}})();`
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
  const { language, themes, themePreset, enabledPalettes, typography, customFont, motion } = await getSettings()
  const blob = blobOrigin()
  // No `antialiased` on <html>: it forces grayscale smoothing on Mac, thinning body text.
  // data-motion is server-rendered from settings (site-wide), so the motion engine
  // is on/off at first paint — no flash, no client JS. CSS also forces it off under
  // prefers-reduced-motion. All durations collapse to 0s when off (globals.css).
  return (
    <html lang={language} data-motion={motion.enabled ? 'on' : 'off'} className="h-full">
      <body className="min-h-full">
        {/* Preload the Latin Inter subset (needed by almost every page) — no swap flash. */}
        <link rel="preload" href="/fonts/inter-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        {blob && (
          <>
            <link rel="preconnect" href={blob} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={blob} />
          </>
        )}
        {/* All palettes' colors as CSS vars; client swaps via <html data-palette>. */}
        <style dangerouslySetInnerHTML={{ __html: themesToCss(themes, themePreset) }} />
        {/* Owner type scale → fs/lh/ls vars (overrides globals.css) + custom @font-face. */}
        <style dangerouslySetInnerHTML={{ __html: typographyToCss(typography) + fontToCss(customFont) }} />
        <script dangerouslySetInnerHTML={{ __html: noFouc(enabledPalettes) }} />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
