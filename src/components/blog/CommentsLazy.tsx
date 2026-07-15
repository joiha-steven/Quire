'use client'

// Defers the comment island until the reader scrolls near the foot of the article.
// Comments sit below the body + related posts, so most sessions never reach them —
// yet the island statically pulls in `next-auth/react`. Gating it behind an
// IntersectionObserver keeps that JS (and the comment code itself) out of the
// initial reader payload; the post page stays fully static/ISR. A `rootMargin`
// starts the chunk fetch ~one viewport early so it's ready by the time it's seen.
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import type { SiteLang } from '@/types'

// ssr:false — the tree is fetched client-side (no-store) anyway, so there is
// nothing to server-render; this simply moves the code to an on-demand chunk.
const Comments = dynamic(() => import('./Comments').then((m) => m.Comments), { ssr: false })

export function CommentsLazy(props: {
  postSlug: string
  lang: SiteLang
  turnstile?: boolean
  turnstileSiteKey?: string
  googleAuth?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (show) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true)
          io.disconnect()
        }
      },
      { rootMargin: '600px' }, // begin loading before the anchor enters the viewport
    )
    io.observe(el)
    return () => io.disconnect()
  }, [show])
  return <div ref={ref}>{show && <Comments {...props} />}</div>
}
