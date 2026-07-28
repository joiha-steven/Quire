// What a SHARED cache may do with a page. One rule, at the door.
//
// Nothing was sent at all, and the CDN in front of this decides for itself what that means:
// a staging article came back from the edge two deploys stale, and an hour went into
// chasing a bug that had already been fixed. On the live domain the same thing is a
// published post nobody can see.
//
// This is about the SHARED cache only. The in-process page cache is a different thing with
// a different rule — Invariant 1, cleared completely after every write — and it is exact
// where this is a window.

import type { MiddlewareHandler } from 'hono'

/**
 * 60 seconds, and the edge may keep answering while it refreshes.
 *
 * Short enough that a publish is visible almost at once, long enough that a burst of
 * readers costs one render. `stale-while-revalidate` is what keeps the refresh off the
 * reader's critical path: the first request after expiry is answered from the stale copy
 * and the edge fetches a new one behind it.
 */
const PUBLIC = 'public, s-maxage=60, stale-while-revalidate=600'

/**
 * The owner's own surfaces, and anything that is not a 200.
 *
 * An admin shell or a sign-in page held by a shared cache is a page served to somebody it
 * was not rendered for. A cached 404 is worse than useless: it outlives the reason for it.
 */
const PRIVATE = 'private, no-store'

const OWNER_PATH = /^\/(admin|login|api)(\/|$)/

export function cacheHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    // A handler that has already said what it wants is left alone: the asset routes are
    // immutable-for-a-year, and the machine surfaces set their own.
    if (c.res.headers.has('cache-control')) return
    // Anything that is not a 200 is refused a shared cache whatever its type: a 404 comes
    // back as plain text from the framework, and a cached one outlives the reason for it.
    if (c.res.status !== 200 || OWNER_PATH.test(c.req.path)) {
      c.res.headers.set('cache-control', PRIVATE)
      return
    }
    if ((c.res.headers.get('content-type') ?? '').includes('text/html')) {
      c.res.headers.set('cache-control', PUBLIC)
    }
  }
}
