'use client'

// Image lightbox for post/page bodies. A client island: it leaves the article
// HTML untouched (stays ISR/static) and, after hydration, makes every `.prose
// figure img` clickable to open a full-size overlay with prev/next + keyboard
// nav. Works for single images and #grid galleries alike (the overlay shows the
// uncropped original, even when a gallery item is square-cropped in the grid).
//
// The image list lives in a ref (read only in handlers, never during render); the
// currently-shown item lives in state, so render reads state only. The overlay is
// an immersive media viewer, so it intentionally uses a fixed dark backdrop + light
// controls (not theme tokens) — the standard lightbox look.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'

type View = { index: number; src: string; alt: string; count: number }

function viewAt(imgs: HTMLImageElement[], index: number): View | null {
  const n = imgs.length
  if (!n) return null
  const i = ((index % n) + n) % n
  const img = imgs[i]
  return { index: i, src: img.currentSrc || img.src, alt: img.alt, count: n }
}

export function Lightbox({ lang }: { lang: SiteLang }) {
  const imgsRef = useRef<HTMLImageElement[]>([])
  const [view, setView] = useState<View | null>(null)
  const s = t(lang)

  // Collect images + wire clicks via delegation on the article (covers lazy ones).
  useEffect(() => {
    const root = document.querySelector<HTMLElement>('.prose')
    if (!root) return
    const found = Array.from(root.querySelectorAll<HTMLImageElement>('figure img'))
    if (found.length === 0) return
    imgsRef.current = found
    found.forEach((img) => {
      img.style.cursor = 'zoom-in'
    })
    const onClick = (e: MouseEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName !== 'IMG' || !el.closest('figure')) return
      const i = found.indexOf(el as HTMLImageElement)
      if (i >= 0) {
        e.preventDefault()
        setView(viewAt(found, i))
      }
    }
    root.addEventListener('click', onClick)
    return () => root.removeEventListener('click', onClick)
  }, [])

  const open = view !== null
  const close = useCallback(() => setView(null), [])
  // Read the image list from the ref inside the updater — a callback, not render.
  const go = useCallback((delta: number) => setView((v) => (v ? viewAt(imgsRef.current, v.index + delta) : v)), [])

  // Keyboard nav + scroll lock while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      else if (e.key === 'ArrowRight') go(1)
      else if (e.key === 'ArrowLeft') go(-1)
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, close, go])

  if (!view) return null

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-4 sm:p-8"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={view.src}
        alt={view.alt}
        className="max-h-[85vh] max-w-full rounded object-contain"
        onClick={(e) => e.stopPropagation()}
      />
      {view.alt && (
        <p className="mt-3 max-w-2xl text-center text-sm text-white/70" onClick={(e) => e.stopPropagation()}>
          {view.alt}
        </p>
      )}
      <button
        type="button"
        aria-label={s.lightboxClose}
        onClick={close}
        className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-2xl text-white/80 hover:bg-white/10 hover:text-white"
      >
        ✕
      </button>
      {view.count > 1 && (
        <>
          <button
            type="button"
            aria-label={s.lightboxPrev}
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            className="absolute left-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-3xl text-white/80 hover:bg-white/10 hover:text-white sm:left-4"
          >
            ‹
          </button>
          <button
            type="button"
            aria-label={s.lightboxNext}
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            className="absolute right-2 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full text-3xl text-white/80 hover:bg-white/10 hover:text-white sm:right-4"
          >
            ›
          </button>
          <div className="absolute bottom-4 text-xs tabular-nums text-white/60">
            {view.index + 1} / {view.count}
          </div>
        </>
      )}
    </div>
  )
}
