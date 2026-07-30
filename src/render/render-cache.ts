// The content-addressed render cache, in SQLite.
//
// Two things use it, for the same reason: they are expensive, pure functions of their own
// input, so the input IS the key and there is no invalidation problem. A changed input is a
// different key and a stale row is inert — which is why this cache is deliberately NOT
// emptied by `clearCache()` (Invariant 1) and survives a restart.
//
// Extracted from `highlight.ts` when the rendered BODY joined the highlighter in here.
// Schema note in `docs/spec/01-schema.md` section 4.

import { createHash } from 'node:crypto'
import { one, run } from '@/store/query'
import { nowMs } from '@/store/db'

/**
 * A key from any number of parts, separated so that "ab" + "c" cannot collide with
 * "a" + "bc".
 *
 * The separator is the escape `\0`, never a literal NUL byte. `highlight.ts` had three
 * of those typed straight into a template literal, which is why `grep` reported that file
 * as binary and refused to search it: a source file the tools will not read is a source
 * file nobody edits confidently.
 */
export const renderKey = (...parts: string[]): string =>
  createHash('sha256').update(parts.join('\0')).digest('hex')

export function readRendered(key: string): string | null {
  try {
    return one<{ html: string }>(`select html from render_cache where key = ?`, key)?.html ?? null
  } catch {
    // A cache that cannot be read is a slower render, never a failed one. This runs before
    // `openDatabases` in some tooling, and must not be the reason a page 500s.
    return null
  }
}

export function writeRendered(key: string, html: string): void {
  try {
    run(
      `insert into render_cache (key, html, created_at) values (?, ?, ?)
       on conflict(key) do nothing`,
      key, html, nowMs(),
    )
  } catch {
    /* see readRendered */
  }
}

/**
 * How long a row is kept.
 *
 * Every deploy strands a generation of body rows, because the build commit is part of the
 * body key — so the table grows with deploys as much as with writing, and nothing here was
 * ever deleting. The rows are full HTML, so what grew was `quire.db` and every R2 snapshot
 * taken of it.
 */
export const RENDER_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Rows per sweep. The delete scans `created_at`, which is not indexed, and this runtime has
 * one thread: a first sweep over a table that has been filling for months must not be the
 * request that blocks every reader. What is left over goes on the next tick.
 */
const PRUNE_BATCH = 5_000

/**
 * Delete rows older than `maxAgeMs`. Returns how many went.
 *
 * Age, not use: nothing records a read, and adding a `last_read` write to the read path
 * would turn every cache HIT into a database write. The cost of getting it wrong is one
 * re-render — the cache is content-addressed and self-healing, so a pruned row that was
 * still hot comes straight back. There is deliberately no VACUUM: the database runs in WAL
 * mode, the freed pages are reused by the next inserts, and a VACUUM here has cost this
 * project a database before.
 */
export function pruneRendered(maxAgeMs = RENDER_CACHE_MAX_AGE_MS): number {
  try {
    // The subselect is how the batch is bounded: `delete ... limit` needs a SQLite compiled
    // with SQLITE_ENABLE_UPDATE_DELETE_LIMIT, which is not something to depend on.
    return run(
      `delete from render_cache where key in (
         select key from render_cache where created_at < ? limit ?
       )`,
      nowMs() - maxAgeMs, PRUNE_BATCH,
    ).changes
  } catch {
    return 0 // see readRendered: a cache that cannot be swept is not a failed request
  }
}
