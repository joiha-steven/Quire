'use client'

// Catches runtime errors in any non-(blog) segment (e.g. admin) → a 500-style page
// styled like the 404. (blog) errors are caught by (blog)/error.tsx so they keep
// the public shell; root-layout failures fall back to global-error.tsx.
import { useEffect } from 'react'
import { ErrorView } from '@/components/ErrorView'

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return <ErrorView reset={reset} />
}
