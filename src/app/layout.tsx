import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { getSettings } from '@/lib/settings'

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin', 'latin-ext', 'vietnamese'],
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = await getSettings()
  return { title, description: description || undefined }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-neutral-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
