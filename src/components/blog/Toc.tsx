'use client'

// Table of contents for a post. Renders at the top of long articles (>= 3
// headings). Highlights the section currently in view and scrolls smoothly.
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

  function go(e: React.MouseEvent, id: string) {
    e.preventDefault()
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    history.replaceState(null, '', `#${id}`)
  }

  return (
    // Desktop only (xl+). Pinned to the LEFT EDGE OF THE VIEWPORT (50px in), not to
    // the content column — the whole blog is a centered max-width box, so anchoring
    // to the column left put the ToC in a narrow gutter where wide/full-bleed images
    // overlapped it. `fixed` + viewport-left keeps it hard left, clear of content.
    // Vertically centred (top-1/2 + -translate-y-1/2) so it never collides with the
    // header or footer; `max-h`/scroll handles long lists. Title + items flush left.
    <div className="fixed top-1/2 left-[50px] z-10 hidden w-60 -translate-y-1/2 xl:block">
      <nav aria-label={title} className="max-h-[80vh] overflow-y-auto rounded-xl border border-[var(--c-rule)] p-5 text-sm">
        <p className="mb-2 font-semibold text-[var(--c-heading)]">{title}</p>
        <ul className="space-y-1.5">
          {headings.map((h) => (
            <li key={h.id}>
              <a
                href={`#${h.id}`}
                onClick={(e) => go(e, h.id)}
                className={`block transition-colors hover:text-[var(--c-heading)] ${
                  active === h.id ? 'font-medium text-[var(--c-heading)]' : 'text-meta'
                }`}
              >
                {h.text}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
