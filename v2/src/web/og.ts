// GET /og — the dynamic Open Graph card.
//
// Everything comes from the query string, so the route reads no settings and touches no
// database: the caller (`render/og.ts`) has already decided what the card says.
//
// SSRF is the whole risk here. `?bg=` and `?font=` are attacker-controlled URLs that the
// SERVER fetches, so both are restricted to this site's own origin. Without that, a public
// URL on the blog becomes a way to probe the machine's network from inside it.

import type { Context } from 'hono'
import { renderOgCard, type OgCard } from '@/render/og-card'

/** Same-origin only. Anything else, including a malformed URL, is dropped. */
function sameOrigin(candidate: string, origin: string): boolean {
  if (!candidate) return false
  try {
    return new URL(candidate).origin === origin
  } catch {
    return false
  }
}

/**
 * Fetch a same-origin image and inline it as a data URI.
 *
 * satori emits `<image href="...">` and hands the SVG to sharp, which does NOT fetch remote
 * references. Passing the URL through would silently produce a card with the gradient and
 * no picture, which is exactly the kind of failure nobody notices until it is on Twitter.
 */
async function inlineImage(url: string): Promise<string | undefined> {
  try {
    const res = await fetch(url)
    if (!res.ok) return undefined
    const type = res.headers.get('content-type') ?? 'image/jpeg'
    if (!type.startsWith('image/')) return undefined
    const bytes = new Uint8Array(await res.arrayBuffer())
    return `data:${type};base64,${Buffer.from(bytes).toString('base64')}`
  } catch {
    return undefined // a missing background is a gradient, not an error page
  }
}

export async function handleOg(c: Context): Promise<Response> {
  const url = new URL(c.req.url)
  const q = url.searchParams
  const origin = url.origin

  // Caps mirror the frozen route. They bound the work this endpoint can be asked to do:
  // it is public and uncached upstream, so an unbounded title is an unbounded render.
  const card: OgCard = {
    title: (q.get('title') ?? '').slice(0, 160),
    desc: (q.get('desc') ?? '').slice(0, 340) || undefined,
    date: (q.get('date') ?? '').slice(0, 60) || undefined,
    site: (q.get('site') ?? '').slice(0, 120) || undefined,
  }

  const bg = q.get('bg') ?? ''
  if (sameOrigin(bg, origin)) card.bg = await inlineImage(bg)

  const font = q.get('font') ?? ''
  if (sameOrigin(font, origin)) {
    card.customFont = await fetch(font)
      .then((r) => (r.ok ? r.arrayBuffer() : undefined))
      .catch(() => undefined)
  }

  try {
    const png = await renderOgCard(card)
    return new Response(png, {
      headers: {
        'content-type': 'image/png',
        // A card is a pure function of its query string, so it is safe to cache hard.
        // Crawlers refetch these often and rendering one is not cheap.
        'cache-control': 'public, max-age=86400, s-maxage=604800, immutable',
      },
    })
  } catch (error) {
    console.error(`[ERROR] og: ${(error as Error).message}`)
    return c.text('Could not render card', 500)
  }
}
