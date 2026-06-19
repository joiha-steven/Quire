import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { ToastProvider } from '@/components/ui/Toast'
import { getSettings } from '@/lib/settings'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin', 'latin-ext'] })

export async function generateMetadata(): Promise<Metadata> {
  const { title, description } = await getSettings()
  return { title, description: description || undefined }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-white text-neutral-900">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
