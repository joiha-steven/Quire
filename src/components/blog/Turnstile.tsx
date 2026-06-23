'use client'

// Cloudflare Turnstile widget. Loads the script once (shared across instances),
// renders explicitly into a ref, and reports the token up via `onToken` (null on
// expiry/error so the parent can re-gate). The parent keeps `onToken` stable.
import { useEffect, useRef } from 'react'

type RenderOpts = {
  sitekey: string
  callback: (token: string) => void
  'expired-callback': () => void
  'error-callback': () => void
}
type TurnstileApi = {
  render: (el: HTMLElement, opts: RenderOpts) => string
  remove: (id: string) => void
}
declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

const SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

export function Turnstile({ siteKey, onToken }: { siteKey: string; onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const render = () => {
      if (cancelled || !ref.current || !window.turnstile || widgetId.current) return
      widgetId.current = window.turnstile.render(ref.current, {
        sitekey: siteKey,
        callback: (t) => onToken(t),
        'expired-callback': () => onToken(null),
        'error-callback': () => onToken(null),
      })
    }

    if (window.turnstile) {
      render()
    } else {
      const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT}"]`)
      if (existing) {
        existing.addEventListener('load', render)
      } else {
        const s = document.createElement('script')
        s.src = SCRIPT
        s.async = true
        s.defer = true
        s.addEventListener('load', render)
        document.head.appendChild(s)
      }
    }

    return () => {
      cancelled = true
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
        widgetId.current = null
      }
    }
  }, [siteKey, onToken])

  return <div ref={ref} className="min-h-[65px]" />
}
