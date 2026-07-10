'use client'

// Table of contents for a post, rendered inside the left-gutter rail. No panel:
// no border, no shadow, no background, just type sitting on the page. The section
// in view is marked with the accent hairline (`.rail-row[aria-current]`).
// Below the rail breakpoint this is hidden and the headings ride in the header
// menu instead (see MenuContext).
import { useEffect, useState } from 'react'
import type { Heading } from '@/lib/utils'

export function Toc({ headings, title }: { headings: Heading[]; title: string }) {
  const [active, setActive] = useState<string>('')

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
