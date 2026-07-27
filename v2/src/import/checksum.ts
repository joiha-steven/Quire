// Tier 2 verification: a stable checksum over a table's rows, computed by THIS function on
// both sides of the import.
//
// That is the whole design. If Postgres hashed its own rows and SQLite hashed its own, the
// two would differ for reasons that have nothing to do with the data: a timestamp rendered
// as `2026-07-27T10:00:00+00:00` on one side and `2026-07-27T10:00:00.000Z` on the other,
// a boolean as `t` versus `1`, a float with a different trailing digit. Every such
// difference is a false alarm, and a verifier that cries wolf gets ignored on the one run
// that mattered.
//
// So both sides are reduced to the SAME canonical form first, by the SAME code, and only
// then hashed.

import { createHash } from 'node:crypto'

export type Row = Record<string, unknown>

// Separators that can appear in no canonical form, so neither two columns nor two rows can
// run together into a third value that hashes the same. Written as escapes: a raw control
// character in the source is invisible in a diff, which is how it gets deleted by accident.
const UNIT = '\u001f'   // ASCII unit separator, between columns
const RECORD = '\u001e' // ASCII record separator, between rows

/**
 * One value, canonically.
 *
 * - null and undefined collapse: SQLite has no undefined, and a missing JSON key from
 *   PostgREST means the same thing as a NULL column.
 * - Numbers go through `Number()`, so `1` and `1.0` and `"1"` agree.
 * - Booleans become 0/1, matching the storage side.
 * - Everything else is its string form, length-prefixed so `["a","bc"]` cannot hash the
 *   same as `["ab","c"]`.
 */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'n:'
  if (typeof value === 'boolean') return `i:${value ? 1 : 0}`
  if (typeof value === 'number') return Number.isInteger(value) ? `i:${value}` : `f:${value}`
  // An object collapses to its JSON TEXT and then falls through to the string branch, so
  // it lands on `s:<len>:<json>` — exactly what the same value arrives as from the other
  // side. It used to get its own `j:` prefix, which meant `post_revisions.data` could
  // never match: Postgres serves `jsonb` already parsed, SQLite holds it as TEXT, so one
  // side hashed `j:{...}` and the other `s:54099:{...}` on byte-identical content.
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value)
  // A timestamp is normalised to epoch milliseconds so the two sides' renderings of the
  // same instant agree: Postgres sends `2026-07-27T10:00:00+00:00`, SQLite holds
  // 1785...  Without this every dated table would report a permanent false mismatch.
  // A text column that merely LOOKS like a timestamp is normalised on both sides
  // identically, so nothing is lost by being generous here.
  if (ISO_TIMESTAMP.test(s)) {
    const ms = Date.parse(s)
    if (!Number.isNaN(ms)) return `i:${ms}`
  }
  return `s:${s.length}:${s}`
}

const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/

/** One row, over the named columns only, in the order given. */
export function rowDigest(row: Row, columns: readonly string[]): string {
  return columns.map((c) => canonical(row[c])).join(UNIT)
}

/**
 * A table's checksum: rows sorted by primary key, each reduced to its canonical form,
 * hashed in order.
 *
 * Sorting here rather than in SQL keeps the two sides from disagreeing about collation,
 * which is a real difference: Postgres sorts by the database's locale and SQLite sorts by
 * byte value, so `Ä` lands in a different place. Comparing on a locale-independent key
 * removes that as a source of false mismatches.
 */
export function tableChecksum(rows: Row[], key: string, columns: readonly string[]): string {
  const hash = createHash('sha256')
  const sorted = [...rows].sort((a, b) => {
    const ka = String(a[key] ?? '')
    const kb = String(b[key] ?? '')
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
  for (const row of sorted) {
    hash.update(rowDigest(row, columns))
    hash.update(RECORD) // record separator, so two rows cannot run together
  }
  return `${sorted.length}:${hash.digest('hex').slice(0, 32)}`
}

/**
 * The columns compared per table. Deliberately NOT `select *`: derived columns
 * (`posts.search`) and dropped ones (`backup_state.refresh_token`) are expected to differ,
 * and including them would make the checksum permanently red.
 *
 * Timestamps ARE included: they are canonicalised to epoch milliseconds by the caller
 * before hashing, so a shifted date is caught rather than excused.
 */
export const CHECKSUM_COLUMNS = {
  posts: ['slug', 'title', 'content', 'status', 'date', 'excerpt', 'featured_image',
    'cover_image', 'series', 'series_order', 'meta_title', 'meta_description',
    'reading_minutes', 'created_at', 'updated_at', 'deleted_at', 'broadcast_at'],
  pages: ['slug', 'title', 'content', 'status', 'featured_image',
    'created_at', 'updated_at', 'deleted_at'],
  comments: ['id', 'post_slug', 'parent_id', 'depth', 'author_name', 'author_email',
    'author_website', 'author_ip', 'author_country', 'provider', 'content',
    'created_at', 'deleted_at'],
  post_revisions: ['id', 'slug', 'data', 'saved_at'],
  media: ['path', 'filename', 'size', 'uploaded_at', 'width', 'height', 'thumb',
    'variants', 'deleted_at'],
  files: ['url', 'filename', 'size', 'content_type', 'uploaded_at', 'deleted_at'],
  redirects: ['id', 'source', 'destination', 'permanent', 'created_at'],
  subscribers: ['id', 'email', 'status', 'token', 'created_at', 'confirmed_at'],
} as const

export type ChecksumTable = keyof typeof CHECKSUM_COLUMNS

/** The primary key each table is sorted by. */
export const CHECKSUM_KEYS: Record<ChecksumTable, string> = {
  posts: 'slug',
  pages: 'slug',
  comments: 'id',
  post_revisions: 'id',
  media: 'path',
  files: 'url',
  redirects: 'id',
  subscribers: 'id',
}
