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
    // Desktop only. The OUTER track is absolutely positioned in the left gutter
    // (right-full = its right edge at the content column's left edge; mr-10 = gap)
    // and spans the article body height (h-full). The INNER nav is `sticky`, so it
    // starts level with the content top and follows the scroll within the track,
    // then scrolls away once the body ends. Title + items all flush left.
    <div className="absolute top-0 right-full mr-10 hidden h-full w-60 xl:block">
      <nav aria-label={title} className="sticky top-8 rounded-xl border border-[var(--c-rule)] p-5 text-sm">
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
