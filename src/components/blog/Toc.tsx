'use client'

// Table of contents for a post. Renders only when the post has headings (the
// page also gates on >= 3). Highlights the section in view and scrolls smoothly.
// Below the headings, ONE line links to the in-page tags/categories/comments
// (scroll-only). Collapsible on every viewport via a left-edge handle (no text —
// the tab shape is self-explanatory): default OPEN on desktop (xl+, pinned so
// clicks don't dismiss it), default CLOSED on mobile (clicks / outside-tap /
// Escape dismiss it). Solid bg so the panel always sits cleanly over content.
import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/utils'

// In-page anchors the panel jumps to (set on the matching blocks in the post page).
export const TOC_ANCHORS = { tags: 'post-tags', categories: 'post-categories', comments: 'post-comments' }

export function Toc({
  headings,
  title,
  meta,
}: {
  headings: Heading[]
  title: string
  // The combined tags/categories/comments jump (label already joined), if any present.
  meta?: { label: string; anchor: string }
}) {
  const [active, setActive] = useState<string>('')
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false) // xl+: panel stays open, clicks don't close it

  // Default open on desktop, closed on mobile; track the breakpoint live.
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)')
    const apply = () => {
      setPinned(mq.matches)
      setOpen(mq.matches)
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  useEffect(() => {
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null)
    if (!els.length) return
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting)
        if (visible.length) setActive(visible[0].target.id)
      },
      { rootMargin: '0px 0px -70% 0px', threshold: 0 },
    )
    els.forEach((el) => obs.observe(el))
    return () => obs.disconnect()
  }, [headings])

  // Escape closes the floating (non-pinned) panel.
  useEffect(() => {
    if (!open || pinned) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, pinned])

  // No headings → no panel at all (defence in depth; the page already gates on >= 3).
  if (!headings.length) return null

  function goId(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
    if (!pinned) setOpen(false)
  }

  // Clicking the title scrolls back up to the top of the post.
  function goTop(e: React.MouseEvent) {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    history.replaceState(null, '', location.pathname)
    if (!pinned) setOpen(false)
  }

  return (
    <>
      {/* Mobile: outside-tap closes the floating panel (transparent, no dim). */}
      {open && !pinned && <div className="fixed inset-0 z-20 xl:hidden" onClick={() => setOpen(false)} />}

      {/* One flush-left rig: [panel][handle]. Closed = just the handle at the edge. */}
      <div className="fixed top-1/2 left-0 z-30 flex -translate-y-1/2 items-center">
        {open && (
          <nav
            aria-label={title}
            className="max-h-[80vh] w-60 overflow-y-auto rounded-r-xl border border-l-0 border-rule bg-bg p-5 t-small shadow-lg"
          >
            <button
              type="button"
              onClick={goTop}
              className="mb-2 block text-left font-semibold text-heading transition-opacity hover:opacity-70"
            >
              {title}
            </button>
            <ul className="space-y-1.5">
              {headings.map((h) => (
                <li key={h.id}>
                  <a
                    href={`#${h.id}`}
                    onClick={(e) => goId(e, h.id)}
                    className={`block transition-colors hover:text-heading ${
                      active === h.id ? 'font-medium text-heading' : 'text-meta'
                    }`}
                  >
                    {h.text}
                  </a>
                </li>
              ))}
            </ul>
            {meta && (
              <a
                href={`#${meta.anchor}`}
                onClick={(e) => goId(e, meta.anchor)}
                className="mt-4 block text-meta transition-colors hover:text-heading"
              >
                {meta.label}
              </a>
            )}
          </nav>
        )}

        {/* Text-free handle: a tab on the screen edge that toggles the panel. */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label={title}
          aria-expanded={open}
          className="flex items-center rounded-r-lg border border-l-0 border-rule bg-bg py-5 pr-1 pl-0.5 text-meta transition-colors hover:text-heading"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={open ? 'rotate-180' : ''}
            aria-hidden
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    </>
  )
}
