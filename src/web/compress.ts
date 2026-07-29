// Compressing text responses.
//
// `Bun.serve` sends what the handler returns, byte for byte, and nothing here ever set
// `content-encoding` — so every page, stylesheet, bundle and feed left the origin
// uncompressed. Measured: the public stylesheet is 45,269 bytes on the wire and 14,207
// gzipped, and an article page is around 25 KB of HTML that compresses to roughly a fifth.
//
// The CDN re-compresses on its way to the reader, so this is not what a reader downloads;
// it is the origin-to-edge hop, which is a transatlantic fetch on every cache miss and on
// every one of the purges this release just started issuing. It is also what a reader gets
// if the CDN is ever bypassed or removed.
//
// Only text, only when it is worth it, and only when the client asked. An image, a font or
// a WebP variant is already compressed and running gzip over it spends CPU to add bytes.

import type { MiddlewareHandler } from 'hono'

/**
 * Below this, the gzip header and trailer cost more than the saving on typical prose.
 * Chosen to match what nginx and Cloudflare use as their own floor.
 */
const MIN_BYTES = 1024

/** Compressible by type. A binary body is left alone whatever its size. */
const TEXTUAL = /^(?:text\/|application\/(?:json|xml|javascript|manifest\+json|rss\+xml|atom\+xml)|image\/svg)/

export function compression(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    const res = c.res
    if (res.status !== 200 || res.headers.has('content-encoding')) return
    // NEVER an API response. This is for documents a browser fetches, and `/api/` is where
    // the machine surfaces live — the MCP JSON-RPC transport above all, whose client reads
    // the body itself rather than letting a browser stack decode it. Symptom when this rule
    // was missing: the connector authorised fine and stayed connected, because `initialize`
    // is under a kilobyte and went out uncompressed, and then the tool list never arrived,
    // because `tools/list` is over it and did not. They are small payloads read by one
    // caller; there is nothing here worth the risk.
    if (c.req.path.startsWith('/api/')) return
    if (!TEXTUAL.test(res.headers.get('content-type') ?? '')) return
    if (!(c.req.header('accept-encoding') ?? '').includes('gzip')) return

    const body = await res.arrayBuffer()
    if (body.byteLength < MIN_BYTES) {
      // The body has been consumed, so it has to be handed back whatever the decision.
      c.res = new Response(body, { status: res.status, headers: res.headers })
      return
    }
    const gz = Bun.gzipSync(new Uint8Array(body))
    const headers = new Headers(res.headers)
    headers.set('content-encoding', 'gzip')
    headers.delete('content-length') // it is now wrong, and Bun sets the right one
    // Without this a shared cache can hand the gzipped body to a client that never asked
    // for it. `accept-encoding` is the header the answer varies on, so it is the one named.
    const vary = headers.get('vary')
    if (!vary) headers.set('vary', 'Accept-Encoding')
    else if (!/accept-encoding/i.test(vary)) headers.set('vary', `${vary}, Accept-Encoding`)
    c.res = new Response(gz, { status: res.status, headers })
  }
}
