import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { ThemeProvider } from '@/components/theme/ThemeProvider'
import { getSettings } from '@/lib/settings'

// Runs before paint: applies the saved theme (or system/time default) so there
// is no light flash on dark.
const NO_FOUC = `(function(){try{var m=localStorage.getItem('theme')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)||(m==='time'&&(function(){var h=new Date().getHours();return h>=18||h<6})());if(d)document.documentElement.classList.add('dark')}catch(e){}})();`

// English uses Inter; Vietnamese uses Be Vietnam Pro. Both self-hosted.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
})

// Be Vietnam Pro from the official bettergui build (best Vietnamese coverage).
const beVietnamPro = localFont({
  variable: '--font-bvp',
  display: 'swap',
  src: [
    { path: './fonts/BeVietnamPro-Regular.woff2', weight: '400', style: 'normal' },
    { path: './fonts/BeVietnamPro-Medium.woff2', weight: '500', style: 'normal' },
    { path: './fonts/BeVietnamPro-SemiBold.woff2', weight: '600', style: 'normal' },
    { path: './fonts/BeVietnamPro-Bold.woff2', weight: '700', style: 'normal' },
  ],
})

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = await getSettings()
  return { title, description: description || undefined }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { language } = await getSettings()
  const fontVar = language === 'en' ? 'var(--font-inter)' : 'var(--font-bvp)'
  return (
    <html
      lang={language}
      className={`${inter.variable} ${beVietnamPro.variable} h-full antialiased`}
      style={{ '--font-sans': fontVar } as CSSProperties}
    >
      <body className="min-h-full bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
        <script dangerouslySetInnerHTML={{ __html: NO_FOUC }} />
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
