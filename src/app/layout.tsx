import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getSettings, themeToCss, resolveSiteUrl, resolveAppIcon } from '@/lib/settings'
import { blobOrigin } from '@/lib/blob'

// Runs before paint: applies the saved theme (or system/time default) so there
// is no light flash on dark.
const NO_FOUC = `(function(){try{var m=localStorage.getItem('theme')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)||(m==='time'&&(function(){var h=new Date().getHours();return h>=18||h<6})());if(d)document.documentElement.classList.add('dark')}catch(e){}})();`

// Single typeface site-wide: Inter, with full Vietnamese coverage.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
})

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
  const { theme } = await getSettings()
  return {
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: theme.light.bg },
      { media: '(prefers-color-scheme: dark)', color: theme.dark.bg },
    ],
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language, theme } = await getSettings()
  // Content images in posts are raw Blob URLs; warm that connection early.
  const blob = blobOrigin()
  // No `antialiased` class on <html>: it forces grayscale font-smoothing on Mac,
  // which thins body text. Default smoothing keeps reading text at full weight.
  return (
    <html lang={language} className={`${inter.variable} h-full`}>
      <body className="min-h-full">
        {blob && (
          <>
            <link rel="preconnect" href={blob} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={blob} />
          </>
        )}
        {/* Owner-configured reading colors (light + dark) as CSS variables. */}
        <style dangerouslySetInnerHTML={{ __html: themeToCss(theme) }} />
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC }} />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
