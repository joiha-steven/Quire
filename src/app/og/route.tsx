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

// One typeface (Inter, matching the site) across latin + latin-ext + vietnamese
// subsets so mixed Vietnamese/ASCII titles render fully.
async function font(file: string): Promise<ArrayBuffer> {
  return fetch(new URL(`./${file}`, import.meta.url)).then((r) => r.arrayBuffer())
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const title = (searchParams.get('title') || '').slice(0, 160)
  const bg = searchParams.get('bg') || ''
  const site = searchParams.get('site') || ''

  const [latin, latinExt, vietnamese] = await Promise.all([
    font('inter-latin.woff'),
    font('inter-latin-ext.woff'),
    font('inter-vietnamese.woff'),
  ])

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
          fontFamily: 'Inter',
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
      fonts: [
        { name: 'Inter', data: latin, weight: 600, style: 'normal' },
        { name: 'Inter', data: latinExt, weight: 600, style: 'normal' },
        { name: 'Inter', data: vietnamese, weight: 600, style: 'normal' },
      ],
    },
  )
}
