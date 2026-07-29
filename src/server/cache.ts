// Invariant 1, in its 2.0 form.
//
// The frozen tree spread invalidation across Next's ISR page cache, a tagged Data Cache
// and `lib/revalidate.ts`, which computed a per-write superset of affected paths and was
// pinned by a test because it was easy to under-purge. Here there is one Map and every
// write empties all of it. Re-rendering a post from SQLite costs well under a
// millisecond, so a total flush is not a performance question at this scale.
//
// Do NOT reintroduce targeted invalidation. If a measurement ever shows the flush
// matters, the answer is a rollup table or a longer edge TTL, not a dependency graph.
// See docs/02-structure.md, "Caching: the biggest simplification".

/** Rendered public pages, keyed by request path. The renderer fills this in M2. */
export const pageCache = new Map<string, string>()

/**
 * What runs after a flush: re-filling the cache and purging the CDN.
 *
 * A list rather than a direct call, because `cache.ts` is imported by everything that
 * writes — including every test — and the warmer imports the whole renderer. Registering
 * the hook from the server entry point is what keeps a test suite from rendering the
 * archive on each of its several hundred flushes.
 */
type FlushHook = () => void
const hooks: FlushHook[] = []
export function onFlush(hook: FlushHook): void {
  hooks.push(hook)
}

/** Called after EVERY write, unconditionally. No arguments, so it cannot be narrowed. */
export function clearCache(): void {
  pageCache.clear()
  // A hook that throws must not turn a successful save into a 500. It is a cache.
  for (const hook of hooks) {
    try {
      hook()
    } catch (error) {
      console.error(`[ERROR] cache.clearCache hook: ${(error as Error).message}`)
    }
  }
}
