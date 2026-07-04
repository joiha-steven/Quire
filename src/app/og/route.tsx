/* eslint-disable @next/next/no-img-element */
// Dynamic Open Graph image (1200x630). Query: ?title=...&site=...&bg=<image url>.
// The title is rendered over the background image (a post's featured image or
// the owner's fallback image); with no bg it sits on a soft dark-gray gradient.
import { ImageResponse } from 'next/og'

// Edge runtime: fetch(new URL('./font.woff', import.meta.url)) only resolves the
// bundled asset here (Node fetch can't read a file:// URL). Everything comes
// from query params, so no Blob/settings read is needed.
export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Bundled Inter across latin + latin-ext + vietnamese subsets so mixed
// Vietnamese/ASCII titles render fully. This is the default face AND the glyph
// fallback when the owner uses a custom font (see `?font=` handling below).
async function font(file: string): Promise<ArrayBuffer> {
  return fetch(new URL(`./${file}`, import.meta.url)).then((r) => r.arrayBuffer())
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const reqOrigin = new URL(req.url).origin
  // SSRF guard: only fetch images from this site's own origin (binaries are served
  // at /uploads same-origin) — never an arbitrary or internal URL. Applied to BOTH
  // the background image and the custom font below, so the public ?bg= / ?font=
  // params can't be turned into a server-side fetch.
  const allowedImg = (s: string): boolean => {
    if (!s) return false
    try {
      return new URL(s).origin === reqOrigin
    } catch {
      return false
    }
  }
  const title = (searchParams.get('title') || '').slice(0, 160)
  const bgRaw = searchParams.get('bg') || ''
  const bg = allowedImg(bgRaw) ? bgRaw : ''
  // The bottom line is a site name, domain, or (on the home card) the site
  // description — cap it so a long description can't overflow the card.
  const site = (searchParams.get('site') || '').slice(0, 120)

  const [latin, latinExt, vietnamese] = await Promise.all([
    font('inter-latin.woff'),
    font('inter-latin-ext.woff'),
    font('inter-vietnamese.woff'),
  ])

  // One typeface everywhere: when the owner uploaded a custom font, render the
  // card in it too (Inter stays the glyph fallback for anything it lacks, exactly
  // like the site's --font-sans stack). Only fetch from the Blob store host so the
  // public `?font=` param can't be used to fetch arbitrary/internal URLs (SSRF).
  let custom: ArrayBuffer | null = null
  const fontUrl = searchParams.get('font') || ''
  if (allowedImg(fontUrl)) {
    custom = await fetch(fontUrl).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null)
  }
  const family = custom ? 'Site' : 'Inter'

  // Smaller title for longer text so it never overflows the card.
  const titleSize = title.length > 90 ? 52 : title.length > 55 ? 60 : 72

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          position: 'relative',
          background: 'linear-gradient(135deg, #2a2a2e 0%, #1c1c1f 100%)',
          fontFamily: family,
        }}
      >
        {bg ? (
          <img
            src={bg}
            alt=""
            width={1200}
            height={630}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : null}
        {/* Dark overlay so white text is always legible over any image. */}
        {bg ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(28,28,31,0.25) 0%, rgba(28,28,31,0.88) 100%)',
            }}
          />
        ) : null}
        <div style={{ display: 'flex', flexDirection: 'column', padding: 72, position: 'relative' }}>
          <div
            style={{
              fontSize: titleSize,
              lineHeight: 1.15,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: 'rgba(255,255,255,0.65)', display: 'flex' }}>
            {site}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      // Custom face first (rendered as 'Site'); Inter subsets always loaded so any
      // glyph the custom font lacks (e.g. Vietnamese) still resolves — same idea as
      // the site's --font-sans → Inter fallback.
      fonts: [
        ...(custom ? [{ name: 'Site' as const, data: custom, weight: 600 as const, style: 'normal' as const }] : []),
        { name: 'Inter' as const, data: latin, weight: 600 as const, style: 'normal' as const },
        { name: 'Inter' as const, data: latinExt, weight: 600 as const, style: 'normal' as const },
        { name: 'Inter' as const, data: vietnamese, weight: 600 as const, style: 'normal' as const },
      ],
    },
  )
}
