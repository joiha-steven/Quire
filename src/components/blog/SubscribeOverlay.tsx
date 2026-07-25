'use client'

// Modal wrapper around SubscribeForm, opened from the header button. The form is
// already a bordered card on theme tokens, so it IS the modal panel — no second
// frame. Closes on Escape or backdrop click, matching SearchOverlay.
import { useEffect } from 'react'
import type { SiteLang } from '@/types'
import { SubscribeForm } from './SubscribeForm'

export function SubscribeOverlay({ lang, onClose }: { lang: SiteLang; onClose: () => void }) {
  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[70] flex justify-center bg-black/40 px-4 pt-[12vh]" onClick={onClose}>
      {/* rounded-lg matches the form card's radius so the drop shadow follows it. */}
      <div className="h-fit w-full max-w-md rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <SubscribeForm lang={lang} autoFocus />
      </div>
    </div>
  )
}
