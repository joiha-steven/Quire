// LIVE data-integrity check (NOT in check:all — needs real creds + a running DB).
// Cross-checks the media/files tables against the actual binaries on disk
// (STORAGE_LOCAL_DIR), both directions:
//   - manifest -> disk: every binary a row references (original + thumb + the 4
//     -1024/-1600 AVIF/WebP variants when variants=true) must exist on disk.
//   - disk -> manifest: every media/ or files/ binary must be referenced by a row.
// Trashed rows (deleted_at set) KEEP their binaries until purge, so BOTH directions
// consider all rows regardless of deleted_at.
//
// Env from .env.local. Missing creds => warn + exit 0 (skip), so CI without a live
// backend never fails on it. A real mismatch => exit 1.
import { existsSync, readFileSync } from 'node:fs'
import { promises as fs } from 'node:fs'
import path from 'node:path'

// Load .env.local without overwriting already-set vars.
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim())
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STORAGE_LOCAL_DIR, POSTGREST_DIRECT } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STORAGE_LOCAL_DIR) {
  console.log('~ check:consistency:live SKIPPED — missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / STORAGE_LOCAL_DIR (.env.local).')
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')

// Mirror db.ts: bare PostgREST serves tables at `/<table>`, but supabase-js builds
// `${url}/rest/v1/<table>` — strip that prefix when POSTGREST_DIRECT=1.
const dbFetch = (input, init) => {
  if (POSTGREST_DIRECT === '1' && typeof input === 'string') input = input.replace('/rest/v1', '')
  return fetch(input, init)
}
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: dbFetch },
})

// Strip a leading `/uploads/` (with or without an origin) → store-relative pathname.
const toPathname = (url) => url.replace(/^(?:https?:\/\/[^/]+)?\/uploads\//i, '')
const collapse = (s) => s.replace(/(?:https?:\/\/[^/]+)?\/uploads\//gi, '')
const variantNames = (p) => {
  const stem = p.replace(/\.[^.]+$/, '')
  return [`${stem}-1024.avif`, `${stem}-1600.avif`, `${stem}-1024.webp`, `${stem}-1600.webp`]
}

// 1. Every binary a row references (all rows; trashed keep their binaries).
// The files/ prefix also holds non-table binaries: site icons (favicon-/app-icon-),
// the rendered logo, and the custom font — all referenced from the settings JSON,
// not the files table. So settings is part of the "referenced" source too.
const { data: media, error: mErr } = await db.from('media').select('path, thumb, variants')
const { data: files, error: fErr } = await db.from('files').select('url')
const { data: settings, error: sErr } = await db.from('settings').select('data').eq('id', 1).maybeSingle()
if (mErr || fErr || sErr) {
  console.log(`✗ check:consistency:live: DB read failed — ${(mErr || fErr || sErr).message}`)
  process.exit(1)
}

const referenced = new Set()
for (const m of media ?? []) {
  referenced.add(m.path)
  if (m.thumb) referenced.add(m.thumb)
  if (m.variants) for (const v of variantNames(m.path)) referenced.add(v)
}
for (const f of files ?? []) referenced.add(toPathname(f.url))
// Pull every media/ + files/ pathname mentioned anywhere in the settings JSON
// (icons, logo, custom font, OG images).
const settingsJson = collapse(JSON.stringify(settings?.data ?? {}))
for (const m of settingsJson.matchAll(/\b(?:media|files)\/[A-Za-z0-9._-]+/g)) referenced.add(m[0])

// 2. Every binary actually on disk (walk STORAGE_LOCAL_DIR).
const present = new Set()
const walk = async (dir, base) => {
  let entries
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return // dir does not exist yet → no binaries
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name)
    const rel = base ? `${base}/${e.name}` : e.name
    if (e.isDirectory()) await walk(abs, rel)
    else present.add(rel)
  }
}
await walk(path.resolve(STORAGE_LOCAL_DIR), '')

// 3. Compare both directions.
const violations = []
for (const p of referenced) {
  if (!present.has(p)) violations.push(`manifest -> disk MISSING: ${p}`)
}
for (const p of present) {
  if ((p.startsWith('media/') || p.startsWith('files/')) && !referenced.has(p)) {
    violations.push(`disk -> manifest ORPHAN: ${p}`)
  }
}

console.log(
  `  ${media?.length ?? 0} media + ${files?.length ?? 0} files rows; ` +
    `${referenced.size} referenced binaries vs ${present.size} on disk`,
)
if (violations.length === 0) {
  console.log('✓ check:consistency:live: ok')
  process.exit(0)
}
console.log(`✗ check:consistency:live: ${violations.length} mismatch(es)`)
for (const v of violations) console.log(`  - ${v}`)
process.exit(1)
