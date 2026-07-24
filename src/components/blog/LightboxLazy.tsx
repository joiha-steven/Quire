'use client'

// Defers the Lightbox chunk out of the initial reader bundle: it only matters after
// hydration (it wires click handlers on `.prose` images), so loading it client-side on
// mount costs nothing but keeps its JS off the critical path. Mounted only when the post
// actually has body images (gated by the caller).
import dynamic from 'next/dynamic'
import type { SiteLang } from '@/types'

const Lightbox = dynamic(() => import('./Lightbox').then((m) => ({ default: m.Lightbox })), { ssr: false })

export function LightboxLazy({ lang }: { lang: SiteLang }) {
  return <Lightbox lang={lang} />
}
