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
