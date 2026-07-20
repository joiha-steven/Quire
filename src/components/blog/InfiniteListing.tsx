'use client'

// Infinite-scroll listing: replaces pagination on home / category / tag when
// `features.infiniteScroll` is on. The full published list is handed in as light
// metadata (no post bodies), so revealing more is pure client work — no network.
// The first chunk still server-renders (SSR of this client component) for SEO.
//
// Feed AND the right-gutter date timeline live in ONE island so they share state:
// the timeline scroll-spies the visible month and, on click, reveals up to that
// month and smooth-scrolls to it. Desktop only — `timelineRailCss` hides the rail
// where there is no right gutter. `reveal` card easing is pure CSS (globals.css),
// so appended cards animate with no JS.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Post, SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import { timelineRailCss } from '@/lib/rail-css'
import { buildTimeline, monthKey, type TimelineMonth } from '@/lib/timeline'
import { PostCard } from './PostCard'

export function InfiniteListing({
  posts,
  lang,
  chunk,
  colWidth,
  emptyText,
  showReadingTime = false,
  showCategory = false,
  lead = false,
}: {
  posts: Post[]
  lang: SiteLang
  chunk: number // reveal this many at a time (reuses postsPerPage)
  colWidth: number // reading-column width, for the timeline rail breakpoint
  emptyText: string
  showReadingTime?: boolean
  showCategory?: boolean
  lead?: boolean // first post of the home feed takes the h1 role
}) {
  const step = Math.max(1, chunk)
  const [count, setCount] = useState(() => Math.min(posts.length, step))
  const [activeKey, setActiveKey] = useState('')
  const sentinelRef = useRef<HTMLDivElement>(null)
  const pendingRef = useRef<string | null>(null)

  // Timeline: posts grouped year → month (contiguous, since posts are newest-first).
  const years = useMemo(() => buildTimeline(posts, lang), [posts, lang])

  // Reveal the next chunk as the sentinel nears the viewport.
  useEffect(() => {
    if (count >= posts.length) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => Math.min(posts.length, c + step))
      },
      { rootMargin: '600px 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [count, posts.length, step])

  // Scroll-spy: the month whose anchor sits in the top band of the viewport is active.
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>('.post-list [data-month]'))
    if (!els.length) return
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActiveKey(e.target.getAttribute('data-month') || '')
      },
      { rootMargin: '0px 0px -80% 0px' },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [count])

  // After a jump revealed more posts, the target anchor now exists — scroll to it.
  useEffect(() => {
    const id = pendingRef.current
    if (!id) return
    pendingRef.current = null
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [count])

  const jump = (m: TimelineMonth) => {
    setActiveKey(m.key)
    if (m.firstIndex >= count) {
      pendingRef.current = m.anchorId
      setCount(Math.min(posts.length, m.firstIndex + step))
    } else {
      document.getElementById(m.anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  if (posts.length === 0) return <p className="py-16 text-center text-meta">{emptyText}</p>

  const labels = t(lang)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: timelineRailCss(colWidth) }} />
      {/* `.post-list` is the hook the header Grid toggle switches to a CSS grid. */}
      <div className="post-list flex flex-col gap-16">
        {posts.slice(0, count).map((p, i) => {
          const key = monthKey(p.date)
          const first = i === 0 || monthKey(posts[i - 1].date) !== key
          return (
            <PostCard
              key={p.slug}
              post={p}
              lang={lang}
              showReadingTime={showReadingTime}
              showCategory={showCategory}
              lead={lead && i === 0}
              anchorId={first ? `tl-${key}` : undefined}
              month={first ? key : undefined}
            />
          )
        })}
      </div>
      <div ref={sentinelRef} aria-hidden />

      {/* Right-gutter timeline (desktop only via timelineRailCss). */}
      <aside className="rail rail-timeline">
        <div className="rail-inner">
          <h2 className="mb-3 t-small font-semibold text-heading">{labels.timelineTitle}</h2>
          <nav className="tl-track" aria-label={labels.timelineTitle}>
            {years.map((y) => (
              <div key={y.year}>
                <div className="tl-year t-small font-semibold text-heading">{y.year}</div>
                {y.months.map((m) => (
                  <button key={m.key} type="button" onClick={() => jump(m)} className="tl-month t-small" aria-current={activeKey === m.key ? 'true' : undefined}>
                    <span className="tl-dot" aria-hidden />
                    <span className="tl-label">{m.label}</span>
                    <span className="tl-count tabular-nums">{m.count}</span>
                  </button>
                ))}
              </div>
            ))}
          </nav>
        </div>
      </aside>
    </>
  )
}
