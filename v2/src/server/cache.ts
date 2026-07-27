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

/** Called after EVERY write, unconditionally. No arguments, so it cannot be narrowed. */
export function clearCache(): void {
  pageCache.clear()
}
