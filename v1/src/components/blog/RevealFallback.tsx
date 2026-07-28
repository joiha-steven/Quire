'use client'

// Scroll-reveal fallback for browsers WITHOUT CSS scroll-timeline (Safari,
// Firefox). Chromium eases `.reveal` cards in purely in CSS (globals.css) and
// never needs this: the pre-paint script in the root layout arms
// `data-reveal-js='on'` ONLY where scroll-timeline is unsupported, motion is on,
// and reduced-motion is not requested — so this island runs solely on the
// browsers that would otherwise show the cards with no motion at all. It eases
// each card in with an IntersectionObserver, matching the CSS keyframe (fade +
// 10px rise). No-JS keeps `.reveal` fully visible (the attr is never set).
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function RevealFallback() {
  const pathname = usePathname()
  useEffect(() => {
    // Guard, don't set: the pre-paint script owns the attribute. Absent here =
    // the CSS scroll-timeline path (Chromium) or motion off — nothing to do.
    if (document.documentElement.getAttribute('data-reveal-js') !== 'on') return
    const scope = document.getElementById('content') || document.body

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in')
            io.unobserve(e.target)
          }
        }
      },
      // Reveal a touch before the card is fully in view, echoing the CSS range.
      { rootMargin: '0px 0px -10% 0px' },
    )
    const arm = () => scope.querySelectorAll('.reveal:not(.is-in)').forEach((el) => io.observe(el))
    arm()
    // Cards appended by infinite scroll (or swapped in on a client nav) get armed too.
    const mo = new MutationObserver(arm)
    mo.observe(scope, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
    }
  }, [pathname])
  return null
}
