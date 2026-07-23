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

const OUTER_MARGIN = 48 // px min gap to the viewport edge when there's no rail to anchor to
const MAX_WIDTH = 1400 // px cap so the spread doesn't sprawl on ultrawide monitors
const COL_GAP = 56 // px between the two columns
const FADE_MS = 200 // spread-to-spread crossfade

// The spread spans the SAME footprint the page occupies incl. both side gutters (the ToC rail
// sits in the left gutter; the layout is centred, so the right gutter mirrors it). Width =
// viewport − 2×railLeft. Falls back to near-full width when no rail is on screen.
function spreadWidth(): number {
  const vw = window.innerWidth
  let w = vw - OUTER_MARGIN * 2
  const rail = document.querySelector('.rail')
  if (rail) {
    const r = rail.getBoundingClientRect()
    if (r.width > 0 && r.left >= OUTER_MARGIN) w = vw - Math.round(r.left) * 2
  }
  return Math.min(w, MAX_WIDTH)
}

export function BookMode({ title, lang }: { title: string; lang: SiteLang }) {
  const tx = t(lang)
  const [open, setOpen] = useState(false)
  // `#read` drives the reader, so it's a real, shareable link: /slug#read opens book mode on
  // load, the toggle is a plain <a href="#read">, and Back closes it (the hash leaves history).
  useEffect(() => {
    const sync = () => setOpen(window.location.hash === '#read')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const close = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setOpen(false)
  }, [])
  return (
    <>
      <a className="book-mode-toggle" href="#read">
        {tx.bookMode}
      </a>
      {open && <BookReader title={title} tx={tx} onClose={close} />}
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
    const contentW = spreadWidth()
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
    const src = document.getElementById('post-body')
    const flow = flowRef.current
    if (!flow || !src) return
    // Clone the INNER .prose content (not #post-body's wrapper) so the flow has ONE .prose
    // level — its first child is the real first paragraph, so the top-margin reset + drop cap
    // land on it and the first column opens flush with the second.
    flow.innerHTML = (src.querySelector('.prose') ?? src).innerHTML
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
            — {spread + 1} / {spreadCount} —
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
