// GET /api/newsletter/open?t= — the 1x1 open-tracking pixel embedded in a broadcast.
// Public (it is fetched by the reader's mail client, which has no session) and
// deliberately dumb: it stamps the SEND row the token belongs to and returns a
// transparent GIF. The token maps to a send, never to an address, so the URL carries no
// identity; an unknown token is a silent no-op (still a valid GIF, never a 404 in an
// inbox). No IP, user-agent or referrer is recorded.

import type { NextRequest } from 'next/server'
import { recordOpen } from '@/lib/newsletter-log'
import { logRequest } from '@/lib/api'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

// Smallest transparent GIF (43 bytes).
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')

function gif(): Response {
  return new Response(new Uint8Array(PIXEL), {
    headers: {
      'content-type': 'image/gif',
      'content-length': String(PIXEL.length),
      // Never cache: a cached pixel would hide later opens and, more importantly, the
      // proxies in front of some inboxes would otherwise serve it without hitting us.
      'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    },
  })
}

export async function GET(req: NextRequest): Promise<Response> {
  const start = Date.now()
  // Always answer with the pixel — a tracking failure must never show a broken image.
  await recordOpen(req.nextUrl.searchParams.get('t') ?? '')
  logRequest(req, 200, start)
  return gif()
}
