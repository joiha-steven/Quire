'use client'

// Table of contents for a post, rendered inside the left-gutter rail. No panel:
// no border, no shadow, no background, just type sitting on the page. The section
// in view is marked with the accent hairline (`.rail-row[aria-current]`).
// Below the rail breakpoint this is hidden and the headings ride in the header
// menu instead (see MenuContext).
import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/utils'

// The section you are reading is the LAST heading that has passed the reading
// line, not the one crossing the viewport. (An IntersectionObserver on the
// headings alone goes blank in the middle of a long section — the heading has
// already scrolled away, so nothing intersects and no row is marked.)
const READING_LINE = 120 // px from the top of the viewport

export function Toc({ headings, title }: { headings: Heading[]; title: string }) {
  const [active, setActive] = useState<string>('')

  useEffect(() => {
    const ids = headings.map((h) => h.id)
    if (!ids.length) return
    const pick = () => {
      let current = ''
      for (const id of ids) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= READING_LINE) current = id
      }
      // Above the first heading, mark the first one rather than nothing.
      setActive(current || ids[0])
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

  if (!headings.length) return null

  function goId(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    <nav aria-label={title}>
      <h2 className="mb-3 pl-3.5 t-small font-semibold text-heading">{title}</h2>
      <ul>
        {headings.map((h) => (
          <li key={h.id} className="mt-2 first:mt-0">
            <a
              href={`#${h.id}`}
              onClick={(e) => goId(e, h.id)}
              aria-current={active === h.id ? 'location' : undefined}
              className={`rail-row block cursor-pointer t-small transition-colors hover:text-heading ${
                active === h.id ? 'font-medium text-heading' : 'text-meta'
              }`}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
