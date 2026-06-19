import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getSettings, themeToCss } from '@/lib/settings'

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
  const { title, description } = await getSettings()
  return { title, description: description || undefined }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language, theme } = await getSettings()
  return (
    <html lang={language} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full">
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
