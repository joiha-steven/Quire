// The two SQLite connections, their PRAGMAs, and schema application at boot.
//
// `bun:sqlite` is SYNCHRONOUS and the runtime is single-threaded, so there is exactly one
// writer by construction: a statement cannot interleave with another request. No pool, no
// mutex, no SQLITE_BUSY retry loop. That is the largest simplification 2.0 gets over the
// Go design, which had to build all three.
//
// The cost to respect: a slow query blocks every request. Keep the request path indexed,
// and run anything unbounded (the analytics dashboard, a backup export) against
// `analytics.db` or off the request path entirely.
import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

// Imported as text so both files compile into the standalone executable. A schema the
// binary cannot find is a boot failure on a machine that has no repository checkout.
import contentSchema from './schema.sql' with { type: 'text' }
import analyticsSchema from './schema-analytics.sql' with { type: 'text' }

export type Db = Database

// Set on EVERY connection. WAL lets readers never block the writer; NORMAL is safe under
// WAL; foreign_keys is OFF by default in SQLite and has to be asked for.
const PRAGMAS = [
  'journal_mode = WAL',
  'busy_timeout = 5000',
  'foreign_keys = ON',
  'cache_size = -64000', // 64 MB page cache
  'temp_store = MEMORY',
] as const

let content: Database | null = null
let analytics: Database | null = null

function open(path: string, schema: string, synchronous: 'FULL' | 'NORMAL'): Database {
  const db = new Database(path, { create: true, strict: true })
  for (const p of PRAGMAS) db.run(`pragma ${p};`)
  // Content is worth an fsync per commit; analytics is not. Losing a day of pageviews is
  // an annoyance, losing a day of posts is a disaster.
  db.run(`pragma synchronous = ${synchronous};`)
  db.transaction(() => db.run(schema))()
  return db
}

/**
 * Open both databases under `dir`, applying each schema inside a transaction. Idempotent:
 * every statement in the schema files is `if not exists`, so a second call against an
 * existing database is a no-op rather than an error.
 */
export function openDatabases(dir: string): { db: Database; analyticsDb: Database } {
  // Close any prior pair first. Without this a second call leaks the first pair's file
  // handles, which on Windows makes the files undeletable and on Linux leaks descriptors
  // silently until something runs out. Found by the boot test, which calls this twice on
  // purpose to prove the schema is idempotent.
  closeDatabases()
  mkdirSync(dir, { recursive: true })
  content = open(join(dir, 'quire.db'), contentSchema, 'FULL')
  analytics = open(join(dir, 'analytics.db'), analyticsSchema, 'NORMAL')
  // Only `analytics_totals` (the Views column on the admin content tables) needs to join
  // across the two files. ATTACH once here rather than per query.
  content.run(`attach database ? as analytics;`, [join(dir, 'analytics.db')])
  return { db: content, analyticsDb: analytics }
}

export function db(): Database {
  if (!content) throw new Error('db() before openDatabases(): call it once at boot')
  return content
}

export function analyticsDb(): Database {
  if (!analytics) throw new Error('analyticsDb() before openDatabases(): call it once at boot')
  return analytics
}

export function closeDatabases(): void {
  content?.close()
  analytics?.close()
  content = analytics = null
}

/**
 * Invariant 6: every delete is a soft delete, and EVERY live read filters trashed rows.
 * The predicate is defined ONCE, here, so a new query cannot quietly disagree with the
 * rest of the codebase. Trash reads the complement.
 *
 * Usage: `select ... from posts where ${liveOnly('posts')} and ...`
 */
export function liveOnly(table: string): string {
  return `${table}.deleted_at is null`
}

/**
 * Timestamps are INTEGER milliseconds since epoch, UTC, everywhere. These two exist so no
 * call site invents its own convention, and so a search for "Date.now()" in the data layer
 * finds nothing.
 */
export const nowMs = (): number => Date.now()
export const toDate = (ms: number | null): Date | null => (ms === null ? null : new Date(ms))
