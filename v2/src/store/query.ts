// Three primitives over `bun:sqlite`, so a data-layer module reads as SQL plus a mapper
// rather than as statement plumbing.
//
// This is deliberately NOT a query builder. The frozen tree used PostgREST's builder and
// the chains grew hard to read the moment a query stopped being trivial; a literal with
// bound parameters says exactly what runs. The hard rule in CLAUDE.md ("no SQL string
// building") is enforceable precisely because nothing here concatenates.
//
// Everything is synchronous, because `bun:sqlite` is. Modules that expose these keep
// their `async` signatures: their callers already await them, and changing that would
// turn a data-layer port into an edit of every route and component.
import type { SQLQueryBindings } from 'bun:sqlite'
import { db } from './db'

/**
 * Rows for a query. Pass parameters positionally (`?`), or pass ONE object for named
 * parameters (`$name`, or bare `name` since the connection is opened `strict: true`) —
 * which is what the wide inserts use, where counting seventeen question marks is how a
 * column ends up in the wrong place.
 */
export function all<T>(sql: string, ...params: SQLQueryBindings[]): T[] {
  return db().query<T, SQLQueryBindings[]>(sql).all(...params)
}

/** First row, or null. The `.maybeSingle()` of the frozen tree. */
export function one<T>(sql: string, ...params: SQLQueryBindings[]): T | null {
  return db().query<T, SQLQueryBindings[]>(sql).get(...params)
}

/** A write. `changes` is the affected row count, which several call sites report. */
export function run(sql: string, ...params: SQLQueryBindings[]): { changes: number } {
  // Via `query().run()` rather than `db().run()`: the latter types its rest parameter as
  // an array OF binding arrays, which no spread of plain values satisfies.
  const result = db().query<unknown, SQLQueryBindings[]>(sql).run(...params)
  return { changes: result.changes }
}

/**
 * Run `body` in one transaction. There is exactly one writer (single-threaded runtime,
 * synchronous driver), so this is about atomicity, not about locking: a multi-statement
 * write either lands whole or not at all.
 *
 * `body` must be synchronous. An async body would commit at the first await, before its
 * own later statements run, which is the failure mode this exists to prevent.
 */
export function tx<T>(body: () => T): T {
  return db().transaction(body)()
}
