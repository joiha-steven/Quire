import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import { Inter, Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { getSettings } from '@/lib/settings'

// English uses Inter; Vietnamese uses Be Vietnam Pro. Both self-hosted.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
})

const beVietnamPro = Be_Vietnam_Pro({
  variable: '--font-bvp',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
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
