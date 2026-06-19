import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { Inter } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { getSettings } from '@/lib/settings'

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
      <body className="min-h-full bg-white text-neutral-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
