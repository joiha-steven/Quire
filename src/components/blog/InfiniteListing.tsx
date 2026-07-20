'use client'

// Infinite-scroll listing: replaces pagination on home / category / tag when
// `features.infiniteScroll` is on. The full published list is handed in as light
// metadata (no post bodies), so revealing more is pure client work — no network.
// The first chunk still server-renders (SSR of this client component) for SEO.
//
// The date timeline is NOT a separate widget: each year's FIRST post carries a year
// marker placed out in the right gutter (via `timelineCss`), with a spine down the feed.
// So the years line up with the posts on the left and scroll with the page — no JS, no
// measurement. `reveal` card easing is pure CSS (globals.css), so appended cards animate.
import { useEffect, useRef, useState } from 'react'
import type { Post, SiteLang } from '@/types'
import { timelineCss } from '@/lib/rail-css'
import { PostCard } from './PostCard'

const yearOf = (iso: string) => iso.slice(0, 4)

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
  colWidth: number // reading-column width, for the timeline breakpoint
  emptyText: string
  showReadingTime?: boolean
  showCategory?: boolean
  lead?: boolean // first post of the home feed takes the h1 role
}) {
  const step = Math.max(1, chunk)
  const [count, setCount] = useState(() => Math.min(posts.length, step))
  const sentinelRef = useRef<HTMLDivElement>(null)

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

  if (posts.length === 0) return <p className="py-16 text-center text-meta">{emptyText}</p>

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: timelineCss(colWidth) }} />
      {/* `.post-list` is the hook the header Grid toggle switches to a CSS grid. */}
      <div className="post-list flex flex-col gap-16">
        {posts.slice(0, count).map((p, i) => {
          const year = yearOf(p.date)
          const firstOfYear = i === 0 || yearOf(posts[i - 1].date) !== year
          return (
            <PostCard
              key={p.slug}
              post={p}
              lang={lang}
              showReadingTime={showReadingTime}
              showCategory={showCategory}
              lead={lead && i === 0}
              year={firstOfYear ? year : undefined}
            />
          )
        })}
      </div>
      <div ref={sentinelRef} aria-hidden />
    </>
  )
}
