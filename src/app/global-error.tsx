'use client'

// Last resort: catches errors in the ROOT layout itself, so it must render its own
// <html>/<body> and pull in globals.css (the failed layout provides neither). Uses
// the default palette/typography from globals.css; language can't be resolved here
// (the layout that sets <html lang> failed), so ErrorView falls back to English.
import './globals.css'
import { ErrorView } from '@/components/ErrorView'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  console.error(error)
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full">
        <ErrorView reset={reset} />
      </body>
    </html>
  )
}
