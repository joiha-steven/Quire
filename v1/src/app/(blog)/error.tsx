'use client'

// Runtime errors inside the public blog shell → a 500-style page that keeps the
// (blog) header/footer and matches the 404 exactly.
import { useEffect } from 'react'
import { ErrorView } from '@/components/ErrorView'

export default function BlogError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <ErrorView reset={reset} />
}
