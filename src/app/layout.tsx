import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getSettings, themeToCss, resolveSiteUrl } from '@/lib/settings'
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
    // Advertise the RSS feed so readers/aggregators can auto-discover it.
    alternates: settings.seo.rss ? { types: { 'application/rss+xml': '/feed.xml' } } : undefined,
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language, theme } = await getSettings()
  // Content images in posts are raw Blob URLs; warm that connection early.
  const blob = blobOrigin()
  return (
    <html lang={language} className={`${inter.variable} h-full antialiased`}>
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
      </body>
    </html>
  )
}
