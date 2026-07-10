'use client'

// Table of contents for a post, rendered inside the left-gutter rail (a slide-out
// drawer on narrow screens). No panel: no border, no shadow, no background, just
// type sitting on the page.
//
// It opens with the post's title (click = back to the top) and closes with ONE
// jump to whatever end-of-article sections exist (tags / categories / comments),
// so every post has a usable index even when it has no headings at all. The
// section in view carries the accent hairline (`.rail-row[aria-current]`).
import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/utils'

// The section you are reading is the LAST heading that has passed the reading
// line, not the one crossing the viewport. (An IntersectionObserver on the
// headings alone goes blank in the middle of a long section — the heading has
// already scrolled away, so nothing intersects and no row is marked.)
const READING_LINE = 120 // px from the top of the viewport
const TOP = '' // sentinel: above the first heading, the title row is current

export function Toc({
  headings,
  title,
  postTitle,
  meta,
}: {
  headings: Heading[]
  title: string // the rail heading ("Contents")
  postTitle: string
  meta?: { label: string; anchor: string } // "Tags / Categories / Comments"
}) {
  const [active, setActive] = useState<string>(TOP)

  useEffect(() => {
    const ids = headings.map((h) => h.id)
    const pick = () => {
      let current = TOP
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= READING_LINE) current = id
      }
      setActive(current)
    }
    // Coalesce to one measurement per frame: reading rects on every scroll event
    // would force a synchronous layout each time.
    let queued = 0
    const onScroll = () => {
      if (queued) return
      queued = requestAnimationFrame(() => {
        queued = 0
        pick()
      })
    }
    pick()
    addEventListener('scroll', onScroll, { passive: true })
    addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(queued)
      removeEventListener('scroll', onScroll)
      removeEventListener('resize', onScroll)
    }
  }, [headings])

  function goTop(e: React.MouseEvent) {
    e.preventDefault()
    scrollTo({ top: 0, behavior: 'smooth' })
    history.replaceState(null, '', location.pathname)
  }

  function goId(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  const row = (current: boolean) =>
    `rail-row link-accent block cursor-pointer t-small transition-colors hover:text-heading ${
      current ? 'font-medium text-heading' : 'text-meta'
    }`

  return (
    <nav aria-label={title}>
      <h2 className="mb-3 pl-3.5 t-small font-semibold text-heading">{title}</h2>
      <ul>
        <li>
          <a href="#" onClick={goTop} aria-current={active === TOP ? 'location' : undefined} className={row(active === TOP)}>
            {postTitle}
          </a>
        </li>
        {headings.map((h) => (
          <li key={h.id} className="mt-2">
            <a
              href={`#${h.id}`}
              onClick={(e) => goId(e, h.id)}
              aria-current={active === h.id ? 'location' : undefined}
              className={row(active === h.id)}
            >
              {h.text}
            </a>
          </li>
        ))}
        {meta && (
          <li className="mt-4">
            <a href={`#${meta.anchor}`} onClick={(e) => goId(e, meta.anchor)} className={row(false)}>
              {meta.label}
            </a>
          </li>
        )}
      </ul>
    </nav>
  )
}
