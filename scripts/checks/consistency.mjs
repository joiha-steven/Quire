// LIVE data-integrity check (NOT in check:all — needs real creds).
// Cross-checks the media/files tables against the actual Vercel Blob store, both
// directions:
//   - manifest -> blob: every blob a row references (original + thumb + the 4
//     -1024/-1600 AVIF/WebP variants when variants=true) must exist in the store.
//   - blob -> manifest: every media/ or files/ blob must be referenced by a row.
// Trashed rows (deleted_at set) KEEP their blobs until purge, so BOTH directions
// consider all rows regardless of deleted_at.
//
// Env from .env.local. Missing creds => warn + exit 0 (skip), so CI without
// secrets never fails on it. A real mismatch => exit 1.
import { existsSync, readFileSync } from 'node:fs'

// Load .env.local without overwriting already-set vars.
if (existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line.trim())
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, BLOB_READ_WRITE_TOKEN } = process.env
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !BLOB_READ_WRITE_TOKEN) {
  console.log('~ check:consistency:live SKIPPED — missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / BLOB_READ_WRITE_TOKEN (.env.local).')
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')
const { list } = await import('@vercel/blob')

const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const blobHostRe = /^https?:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//i
const toPathname = (url) => url.replace(blobHostRe, '')
// Global host strip (for free-text JSON, not just a single URL).
const collapseHost = (s) => s.replace(/https?:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//gi, '')
const variantNames = (path) => {
  const stem = path.replace(/\.[^.]+$/, '')
  return [`${stem}-1024.avif`, `${stem}-1600.avif`, `${stem}-1024.webp`, `${stem}-1600.webp`]
}

// 1. Every blob a row references (all rows; trashed keep their blobs).
// The files/ prefix also holds non-table blobs: site icons (favicon-/app-icon-),
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
// (icons, logo, custom font, OG images). Collapse any absolute URLs to pathnames first.
const settingsJson = collapseHost(JSON.stringify(settings?.data ?? {}))
for (const m of settingsJson.matchAll(/\b(?:media|files)\/[A-Za-z0-9._-]+/g)) referenced.add(m[0])

// 2. Every blob actually in the store.
const present = new Set()
let cursor
do {
  const res = await list({ cursor, limit: 1000 })
  for (const b of res.blobs) present.add(b.pathname)
  cursor = res.cursor
} while (cursor)

// 3. Compare both directions.
const violations = []
for (const path of referenced) {
  if (!present.has(path)) violations.push(`manifest -> blob MISSING: ${path}`)
}
for (const path of present) {
  if ((path.startsWith('media/') || path.startsWith('files/')) && !referenced.has(path)) {
    violations.push(`blob -> manifest ORPHAN: ${path}`)
  }
}

console.log(
  `  ${media?.length ?? 0} media + ${files?.length ?? 0} files rows; ` +
    `${referenced.size} referenced blobs vs ${present.size} in store`,
)
if (violations.length === 0) {
  console.log('✓ check:consistency:live: ok')
  process.exit(0)
}
console.log(`✗ check:consistency:live: ${violations.length} mismatch(es)`)
for (const v of violations) console.log(`  - ${v}`)
process.exit(1)
