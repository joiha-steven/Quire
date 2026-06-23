'use client'

// Table of contents for a post. Renders at the top of long articles (>= 3
// headings). Highlights the section currently in view and scrolls smoothly.
// Below the headings it links to the in-page tags / categories / comments.
// Desktop (xl+): pinned to the left of the viewport, always visible.
// Mobile (< xl): hidden by default behind a left-edge tab; tapping the tab
// slides the panel out over the content (solid background, so nothing shows
// through), tapping outside or an item closes it again.
import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/utils'

// In-page anchors the panel jumps to (set on the matching blocks in the post page).
export const TOC_ANCHORS = { tags: 'post-tags', categories: 'post-categories', comments: 'post-comments' }

type Jump = { id: string; label: string }

export function Toc({
  headings,
  title,
  jumps,
}: {
  headings: Heading[]
  title: string
  // Optional in-page jumps (tags / categories / comments) shown under the headings.
  jumps: Jump[]
}) {
  const [active, setActive] = useState<string>('')
  const [open, setOpen] = useState(false) // mobile slide-out state only

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

  // Close the mobile panel on Escape.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function goId(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
    setOpen(false)
  }

  // Clicking the title scrolls back up to the top of the post.
  function goTop(e: React.MouseEvent) {
    e.preventDefault()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    history.replaceState(null, '', location.pathname)
    setOpen(false)
  }

  const inner = (
    <>
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
      {jumps.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {jumps.map((j) => (
            <li key={j.id}>
              <a
                href={`#${j.id}`}
                onClick={(e) => goId(e, j.id)}
                className="block text-meta transition-colors hover:text-heading"
              >
                {j.label}
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )

  // Solid background + border so the panel always sits cleanly over the content.
  const navClass =
    'max-h-[80vh] overflow-y-auto rounded-xl border border-rule bg-bg p-5 t-small'

  return (
    <>
      {/* Mobile (< xl): left-edge tab, then slide-out panel over the content. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={title}
        aria-expanded={open}
        className="fixed top-1/2 left-0 z-20 -translate-y-1/2 rounded-r-lg border border-l-0 border-rule bg-bg px-2 py-4 text-meta transition-opacity hover:opacity-70 xl:hidden"
      >
        <span className="t-small [writing-mode:vertical-rl]">{title}</span>
      </button>

      {open && (
        // Transparent full-screen catcher closes on outside tap (no dim, so we
        // never hardcode a non-token colour).
        <div className="fixed inset-0 z-30 xl:hidden" onClick={() => setOpen(false)}>
          <nav
            aria-label={title}
            onClick={(e) => e.stopPropagation()}
            className={`${navClass} absolute top-1/2 left-0 w-64 -translate-y-1/2 border-l-0 shadow-lg`}
          >
            {inner}
          </nav>
        </div>
      )}

      {/* Desktop (xl+): pinned to the left edge of the viewport, always visible. */}
      <div className="fixed top-1/2 left-[50px] z-10 hidden w-60 -translate-y-1/2 xl:block">
        <nav aria-label={title} className={navClass}>
          {inner}
        </nav>
      </div>
    </>
  )
}
