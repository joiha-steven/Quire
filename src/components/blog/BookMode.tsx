'use client'

// Book reading mode: an opt-in fullscreen overlay that re-flows the current post into a
// two-column "book" spread paginated horizontally, advanced with the arrow keys / on-screen
// arrows (a soft fade between spreads). Desktop + iPad only (the toggle is hidden below the
// iPad width in CSS). Not a real Fullscreen-API call — a fixed overlay covers the viewport,
// so desktop and iPad behave identically. The source markup is cloned from the already-
// rendered `#post-body` (Shiki highlight, images, footnotes intact); the base page keeps
// normal scroll, so SEO / a11y / find-in-page are untouched.
import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'

const FALLBACK_WIDTH = 900 // px, only if #post-body can't be measured
const COL_GAP = 56 // px between the two columns
const FADE_MS = 200 // spread-to-spread crossfade

export function BookMode({ title, lang }: { title: string; lang: SiteLang }) {
  const tx = t(lang)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="book-mode-toggle" onClick={() => setOpen(true)}>
        {tx.bookMode}
      </button>
      {open && <BookReader title={title} tx={tx} onClose={() => setOpen(false)} />}
    </>
  )
}

function BookReader({
  title,
  tx,
  onClose,
}: {
  title: string
  tx: ReturnType<typeof t>
  onClose: () => void
}) {
  const flowRef = useRef<HTMLDivElement | null>(null)
  const [spread, setSpread] = useState(0)
  const [spreadCount, setSpreadCount] = useState(1)
  const [visible, setVisible] = useState(true)
  const [step, setStep] = useState(0) // px to translate per spread (2 columns + gaps)

  // Lay the cloned content into columns and recompute how many spreads it makes. Called
  // after mount, on resize, and once webfonts settle (measuring too early miscounts).
  const measure = useCallback(() => {
    const flow = flowRef.current
    if (!flow) return
    // Match the site's own content column so the spread is exactly as wide as the page
    // reads normally (#post-body carries the reading width incl. the shell's padding).
    const contentW = document.getElementById('post-body')?.clientWidth || FALLBACK_WIDTH
    const colW = Math.floor((contentW - COL_GAP) / 2)
    flow.style.setProperty('--book-col-w', `${colW}px`)
    flow.style.width = `${colW * 2 + COL_GAP}px` // the visible viewport = exactly 2 columns
    flow.style.setProperty('--book-page-h', `${flow.clientHeight}px`) // cap media to a page
    setStep((colW + COL_GAP) * 2)
    const totalCols = Math.max(1, Math.round(flow.scrollWidth / (colW + COL_GAP)))
    const count = Math.max(1, Math.ceil(totalCols / 2))
    setSpreadCount(count)
    setSpread((s) => Math.min(s, count - 1))
  }, [])

  // Clone the rendered post body into the flow once, force-eager its images (they sit off-
  // screen in later columns, so lazy-load would never fire), then measure.
  useEffect(() => {
    const flow = flowRef.current
    const src = document.getElementById('post-body')
    if (!flow || !src) return
    flow.innerHTML = src.innerHTML
    flow.querySelectorAll('img').forEach((img) => {
      img.loading = 'eager'
      img.removeAttribute('fetchpriority')
    })
    measure()
    const onFonts = () => measure()
    document.fonts?.ready.then(onFonts)
    let raf = 0
    const onResize = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    window.addEventListener('resize', onResize)
    document.body.classList.add('book-open')
    return () => {
      window.removeEventListener('resize', onResize)
      cancelAnimationFrame(raf)
      document.body.classList.remove('book-open')
    }
  }, [measure])

  // Fade the current spread out, jump, fade back in — reads as "the page dims and reloads".
  const go = useCallback(
    (dir: -1 | 1) => {
      const next = spread + dir
      if (next < 0 || next >= spreadCount) return
      setVisible(false)
      setSpread(next)
      window.setTimeout(() => setVisible(true), FADE_MS)
    },
    [spread, spreadCount],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose()
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, onClose])

  const atStart = spread === 0
  const atEnd = spread >= spreadCount - 1

  return createPortal(
    <div className="book-overlay book-text" role="dialog" aria-modal="true" aria-label={tx.bookMode}>
      <div className="book-chrome book-top">
        <span className="book-title">{title}</span>
        <div className="book-topright">
          <span className="book-count tabular-nums">
            {spread + 1} / {spreadCount}
          </span>
          <button type="button" className="book-x" onClick={onClose} aria-label={tx.bookModeClose} title={tx.bookModeClose}>
            ✕
          </button>
        </div>
      </div>

      <div className="book-stage">
        <button
          type="button"
          className="book-arrow book-prev"
          onClick={() => go(-1)}
          disabled={atStart}
          aria-label={tx.bookModePrev}
        >
          ‹
        </button>
        <div className="book-viewport">
          <div
            ref={flowRef}
            className="book-flow prose"
            style={{
              transform: `translateX(-${spread * step}px)`,
              opacity: visible ? 1 : 0,
            }}
          />
        </div>
        <button
          type="button"
          className="book-arrow book-next"
          onClick={() => go(1)}
          disabled={atEnd}
          aria-label={tx.bookModeNext}
        >
          ›
        </button>
      </div>
    </div>,
    document.body,
  )
}
