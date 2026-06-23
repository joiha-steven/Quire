// Backfill `posts.reading_minutes` for rows missing it (imported/seeded posts had
// none, so list views couldn't show a read time). App saves already set it; this is
// a one-off/idempotent repair. Mirrors lib/utils.ts readingMinutes (toPlainText →
// words/200, min 1) so the number matches what a later save would produce.
//
//   node --env-file=.env.local scripts/backfill-reading-time.mjs [--dry] [--all]
//
// Default: only NULL rows. --all: recompute every post. --dry: preview, no writes.

import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry')
const ALL = process.argv.includes('--all')

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

function toPlainText(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readingMinutes(markdown) {
  const words = toPlainText(markdown || '').split(' ').filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

const { data, error } = await db.from('posts').select('slug, content, reading_minutes')
if (error) throw new Error(error.message)

const targets = (data ?? []).filter((r) => ALL || r.reading_minutes == null)
console.log(`posts: ${data.length}, to update: ${targets.length}${DRY ? ' (dry run)' : ''}`)

let changed = 0
for (const row of targets) {
  const minutes = readingMinutes(row.content)
  if (minutes === row.reading_minutes) continue
  console.log(`  ${row.slug}: ${row.reading_minutes ?? 'null'} -> ${minutes}`)
  if (!DRY) {
    const { error: e } = await db.from('posts').update({ reading_minutes: minutes }).eq('slug', row.slug)
    if (e) throw new Error(`${row.slug}: ${e.message}`)
  }
  changed++
}
console.log(DRY ? `would update ${changed}` : `updated ${changed}`)
