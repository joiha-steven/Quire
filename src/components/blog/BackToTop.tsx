'use client'

// A small "scroll to top" button that fades in once the reader has scrolled past
// the first viewport. Fixed bottom-right, themed like the header icon buttons.
// Passive scroll listener; smooth-scrolls to the top on click.
import { useEffect, useState } from 'react'

export function BackToTop({ label }: { label: string }) {
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className={`fixed bottom-5 right-5 z-40 flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-bg text-meta shadow-sm transition-all hover:text-heading ${
        shown ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m18 15-6-6-6 6" />
      </svg>
    </button>
  )
}
