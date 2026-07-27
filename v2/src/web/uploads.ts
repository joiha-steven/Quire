// GET /uploads/* — serve binaries from the local store.
//
// A near-verbatim port of `app/uploads/[...path]/route.ts`. The file is STREAMED, never
// buffered whole: a 200 MB video must not become 200 MB of resident memory per reader.
//
// Single byte-range requests are honoured (RFC 9110). This is not a nicety: video seeking
// needs 206 responses, and iOS Safari will not play a video at all without them.
//
// Public and read-only. It reads only files the store itself created, and `resolveSafe`
// inside the driver blocks any `..` traversal.

import type { Context } from 'hono'
import { statSize, stream } from '@/media/blob-local'
import { mimeOf } from '@/media/mime'
import { parseRange } from '@/media/http-range'

// Names are content-stable: unique on upload, and a regenerated variant is identical. So
// caching one forever is safe, and it is the whole reason media never needs a cache bust.
const CACHE = 'public, max-age=31536000, immutable'

export async function handleUpload(c: Context): Promise<Response> {
  const pathname = c.req.path.replace(/^\/uploads\//, '')

  let size: number
  try {
    size = await statSize(pathname)
  } catch {
    return c.text('Not found', 404)
  }

  const type = mimeOf(pathname)
  const range = parseRange(c.req.header('range') ?? null, size)
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
    return c.text('Not found', 404)
  }
}
