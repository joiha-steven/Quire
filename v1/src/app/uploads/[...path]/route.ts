// Serve binaries from the local filesystem store. STREAMS the file written under
// STORAGE_LOCAL_DIR back over HTTP at the same `/uploads/<pathname>` URL that blob.ts
// builds — never buffering it whole in memory — and honours single byte-range
// requests (RFC 9110): video seeking, and iOS Safari playback at all, depend on
// 206 responses. Public + read-only: it only reads files the store itself created,
// and `resolveSafe` (inside the driver) blocks any `..` traversal.

import { statSize, stream } from '@/lib/blob-local'
import { mimeOf } from '@/lib/mime'
import { parseRange } from '@/lib/http-range'

// Names are content-stable (unique on upload; variants regenerate identical),
// so a long-cache immutable contract is safe.
const CACHE = 'public, max-age=31536000, immutable'

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params
  const pathname = path.join('/')
  let size: number
  try {
    size = await statSize(pathname)
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const type = mimeOf(pathname)
  const range = parseRange(req.headers.get('range'), size)
  if (range === 'invalid') {
    return new Response(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}`, 'Accept-Ranges': 'bytes' },
    })
  }

  try {
    if (range) {
      return new Response(stream(pathname, range), {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(range.end - range.start + 1),
          'Content-Range': `bytes ${range.start}-${range.end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': CACHE,
        },
      })
    }
    return new Response(stream(pathname), {
      headers: {
        'Content-Type': type,
        'Content-Length': String(size),
        'Accept-Ranges': 'bytes',
        'Cache-Control': CACHE,
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
