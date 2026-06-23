// Serve binaries for the LOCAL storage driver (STORAGE_DRIVER=local). Streams the
// file the local driver wrote under STORAGE_LOCAL_DIR back over HTTP at the same
// `/uploads/<pathname>` URL that blob.ts builds. Inert on Vercel (the store is
// hosted, this route is never linked). Public + read-only: it only reads files the
// driver itself created, and `resolveSafe` blocks any `..` traversal.

import { read } from '@/lib/blob-local'
import { mimeOf } from '@/lib/mime'

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params
  const pathname = path.join('/')
  try {
    const body = await read(pathname)
    return new Response(new Uint8Array(body), {
      headers: {
        'Content-Type': mimeOf(pathname),
        // Names are content-stable (unique on upload; variants regenerate identical),
        // so the same long-cache contract as Vercel Blob applies.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
