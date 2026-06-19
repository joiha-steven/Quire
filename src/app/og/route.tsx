/* eslint-disable @next/next/no-img-element */
// Dynamic Open Graph image (1200x630). Query: ?title=...&bg=<image url>.
// The title is rendered over the background image (a post's featured image or
// the owner's fallback image); with no bg it falls back to a dark gradient.
import { ImageResponse } from 'next/og'

// Edge runtime: fetch(new URL('./font.ttf', import.meta.url)) only resolves the
// bundled asset here (Node fetch can't read a file:// URL). Everything comes
// from query params, so no Blob/settings read is needed.
export const runtime = 'edge'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

async function font(file: string): Promise<ArrayBuffer> {
  return fetch(new URL(`./${file}`, import.meta.url)).then((r) => r.arrayBuffer())
}

export async function GET(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url)
  const title = (searchParams.get('title') || '').slice(0, 160)
  const bg = searchParams.get('bg') || ''
  const site = searchParams.get('site') || ''

  const [semibold, regular] = await Promise.all([
    font('BeVietnamPro-SemiBold.ttf'),
    font('BeVietnamPro-Regular.ttf'),
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
          background: '#0e0e0f',
          fontFamily: 'VN',
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
        {/* Dark gradient so white text is always legible. */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: bg
              ? 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.85) 100%)'
              : 'linear-gradient(135deg, #1a1a20 0%, #0e0e0f 100%)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', padding: 72, position: 'relative' }}>
          <div
            style={{
              fontFamily: 'VN-SB',
              fontSize: titleSize,
              lineHeight: 1.15,
              color: '#ffffff',
              letterSpacing: '-0.02em',
              display: 'flex',
            }}
          >
            {title}
          </div>
          <div style={{ marginTop: 28, fontSize: 30, color: 'rgba(255,255,255,0.7)', display: 'flex' }}>
            {site}
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'VN-SB', data: semibold, weight: 600, style: 'normal' },
        { name: 'VN', data: regular, weight: 400, style: 'normal' },
      ],
    },
  )
}
