// Serve binaries from the local filesystem store. Streams the file written under
// STORAGE_LOCAL_DIR back over HTTP at the same `/uploads/<pathname>` URL that blob.ts
// builds. Public + read-only: it only reads files the store itself created, and
// `resolveSafe` blocks any `..` traversal.

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
        // so a long-cache immutable contract is safe.
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
