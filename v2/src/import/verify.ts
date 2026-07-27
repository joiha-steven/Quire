// The four verification tiers from 05-importer.md, as pure functions over two row sets.
//
// Pure on purpose, again: the importer's whole value is that it can say "this is
// complete" and be believed. A verifier wired directly into two live databases can only be
// tested by having two live databases, which means in practice it is tested once, by hand,
// on the day it is written.

import { tableChecksum, CHECKSUM_COLUMNS, CHECKSUM_KEYS, type ChecksumTable, type Row } from '@/import/checksum'
import { termRows } from '@/import/transform'

export type Finding = {
  tier: 1 | 2 | 3 | 4
  table: string
  fatal: boolean
  detail: string
}

// ----- Tier 1: counts ---------------------------------------------------------

/** Any difference is fatal. Soft-deleted rows are counted on both sides, not filtered. */
export function verifyCounts(source: Record<string, number>, target: Record<string, number>): Finding[] {
  const out: Finding[] = []
  for (const table of Object.keys(source)) {
    const a = source[table] ?? 0
    const b = target[table] ?? 0
    if (a !== b) {
      out.push({ tier: 1, table, fatal: true, detail: `source ${a} rows, imported ${b}` })
    }
  }
  return out
}

// ----- Tier 2: checksums ------------------------------------------------------

export function verifyChecksums(
  table: ChecksumTable, sourceRows: Row[], targetRows: Row[],
): Finding[] {
  const columns = CHECKSUM_COLUMNS[table]
  const key = CHECKSUM_KEYS[table]
  const a = tableChecksum(sourceRows, key, columns)
  const b = tableChecksum(targetRows, key, columns)
  return a === b ? [] : [{
    tier: 2, table, fatal: true,
    detail: `checksum ${a} != ${b}; run tier 3 on this table to see which rows`,
  }]
}

// ----- Tier 3: spot comparison ------------------------------------------------

/**
 * A seeded shuffle, so a failing run is reproducible from the seed printed in the output.
 * `Math.random()` would make "it failed once yesterday" unfixable.
 */
function seededPick<T>(items: T[], n: number, seed: number): T[] {
  let state = seed >>> 0 || 1
  const next = () => {
    // xorshift32: small, deterministic, and good enough to choose sample rows.
    state ^= state << 13; state >>>= 0
    state ^= state >>> 17
    state ^= state << 5; state >>>= 0
    return state / 0x1_0000_0000
  }
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, n)
}

/**
 * Compare N random rows field by field. A checksum says "different"; this says which
 * column of which row, which is the difference between a five-minute fix and an afternoon.
 */
export function verifySpot(
  table: ChecksumTable, sourceRows: Row[], targetRows: Row[], seed: number, sampleSize = 50,
): Finding[] {
  const key = CHECKSUM_KEYS[table]
  const columns = CHECKSUM_COLUMNS[table]
  const byKey = new Map(targetRows.map((r) => [String(r[key]), r]))
  const out: Finding[] = []
  for (const row of seededPick(sourceRows, sampleSize, seed)) {
    const id = String(row[key])
    const other = byKey.get(id)
    if (!other) {
      out.push({ tier: 3, table, fatal: true, detail: `${key}=${id} missing after import` })
      continue
    }
    for (const column of columns) {
      const a = normalise(row[column])
      const b = normalise(other[column])
      if (a !== b) {
        out.push({
          tier: 3, table, fatal: true,
          detail: `${key}=${id} column ${column}: source ${a} != imported ${b}`,
        })
      }
    }
  }
  return out
}

/** Same collapsing rules as the checksum, but readable, because this output is for a human. */
function normalise(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? '1' : '0'
  const s = String(value)
  const ms = /^\d{4}-\d{2}-\d{2}[T ]/.test(s) ? Date.parse(s) : NaN
  if (!Number.isNaN(ms)) return String(ms)
  return s.length > 120 ? `${s.slice(0, 120)}… (${s.length} chars)` : s
}

// ----- Tier 4: semantic -------------------------------------------------------

export type SemanticInput = {
  /** Source posts, with their original array columns. */
  sourcePosts: { slug: string; categories: unknown; tags: unknown }[]
  /** Imported junction rows. */
  targetTerms: { post_slug: string; kind: string; term: string }[]
  /** Imported slugs, to check Invariant 2. */
  postSlugs: string[]
  pageSlugs: string[]
  /** Imported comments, to check parent links. */
  comments: { id: number; parent_id: number | null }[]
  /** Source comments, so a v1 orphan stays an orphan instead of being "repaired". */
  sourceOrphanIds: number[]
  /** Rows soft-deleted in the source, per table, and the same in the target. */
  softDeleted: { table: string; source: number; target: number }[]
}

export function verifySemantic(input: SemanticInput): Finding[] {
  const out: Finding[] = []

  // Terms round-trip in BOTH directions: nothing added, nothing lost.
  const expected = new Set<string>()
  for (const p of input.sourcePosts) {
    for (const t of termRows(p.slug, p.categories, p.tags)) expected.add(`${t.post_slug}|${t.kind}|${t.term}`)
  }
  const actual = new Set(input.targetTerms.map((t) => `${t.post_slug}|${t.kind}|${t.term}`))
  for (const key of expected) {
    if (!actual.has(key)) out.push({ tier: 4, table: 'post_terms', fatal: true, detail: `missing term ${key}` })
  }
  for (const key of actual) {
    if (!expected.has(key)) out.push({ tier: 4, table: 'post_terms', fatal: true, detail: `unexpected term ${key}` })
  }

  // Invariant 2: posts and pages share one /{slug} namespace.
  const pages = new Set(input.pageSlugs)
  for (const slug of input.postSlugs) {
    if (pages.has(slug)) {
      out.push({ tier: 4, table: 'posts', fatal: true, detail: `slug /${slug} exists as BOTH a post and a page` })
    }
  }

  // A comment's parent must exist, OR be a known v1 orphan. Orphans exist by design (the
  // parent was purged and the tree re-roots on read), so they must survive AS orphans.
  const ids = new Set(input.comments.map((c) => c.id))
  const knownOrphans = new Set(input.sourceOrphanIds)
  for (const c of input.comments) {
    if (c.parent_id === null || ids.has(c.parent_id)) continue
    if (!knownOrphans.has(c.id)) {
      out.push({ tier: 4, table: 'comments', fatal: true, detail: `comment ${c.id} points at missing parent ${c.parent_id}` })
    }
  }

  // Invariant 6: a trashed row is still trashed, not silently dropped or restored.
  for (const s of input.softDeleted) {
    if (s.source !== s.target) {
      out.push({
        tier: 4, table: s.table, fatal: true,
        detail: `soft-deleted rows: source ${s.source}, imported ${s.target}`,
      })
    }
  }

  return out
}

/** FTS5 sanity: a word taken from a title must find that post again. */
export function verifySearch(
  samples: { word: string; slug: string; hits: string[] }[],
): Finding[] {
  return samples
    .filter((s) => !s.hits.includes(s.slug))
    .map((s) => ({
      tier: 4 as const, table: 'posts_fts', fatal: true,
      detail: `searching "${s.word}" did not return /${s.slug} (got ${s.hits.slice(0, 3).join(', ') || 'nothing'})`,
    }))
}

export const isFatal = (findings: Finding[]): boolean => findings.some((f) => f.fatal)

export function formatFindings(findings: Finding[]): string {
  if (findings.length === 0) return '  all four tiers passed'
  return findings
    .map((f) => `  ${f.fatal ? 'FATAL' : 'warn '} tier ${f.tier} ${f.table}: ${f.detail}`)
    .join('\n')
}
