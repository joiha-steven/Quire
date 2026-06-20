// One-off: delete every media blob EXCEPT the logo currently set in settings.
// Dry-run by default; pass --apply to actually delete.
//   node --env-file=.env.local scripts/wipe-media.mjs          # inventory only
//   node --env-file=.env.local scripts/wipe-media.mjs --apply  # delete
import { list, del, put } from '@vercel/blob'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN missing (use --env-file=.env.local)')

const m = token.match(/^vercel_blob_rw_([^_]+)_/)
if (!m) throw new Error('Cannot derive Blob base from token')
const BASE = `https://${m[1]}.public.blob.vercel-storage.com`

const fresh = (p) => `${BASE}/${p}?ts=${Date.now()}`
async function readJson(pathname, fallback) {
  const r = await fetch(fresh(pathname), { cache: 'no-store' })
  return r.ok ? r.json() : fallback
}
const pathOf = (url) => { try { return new URL(url).pathname.replace(/^\//, '') } catch { return '' } }

// 1. Which media pathname is the logo? (keep it)
const settings = await readJson('settings/site.json', {})
const logoPath = settings.logoUrl ? pathOf(settings.logoUrl) : ''
console.log(`Logo in use: ${logoPath || '(none)'}`)

// 2. List every blob under media/
let cursor, blobs = []
do {
  const page = await list({ token, prefix: 'media/', cursor, limit: 1000 })
  blobs.push(...page.blobs)
  cursor = page.cursor
} while (cursor)

// Keep the logo; never del the index here (rewritten at the end).
const keep = blobs.filter((b) => b.pathname === logoPath)
const remove = blobs.filter((b) => b.pathname !== logoPath && b.pathname !== 'media/_index.json')

console.log(`\nUnder media/: ${blobs.length} blobs`)
console.log(`  keep:   ${keep.length} (${keep.map((b) => b.pathname).join(', ') || '-'})`)
console.log(`  delete: ${remove.length}`)
for (const b of remove) console.log(`    - ${b.pathname}`)

if (!APPLY) {
  console.log('\nDRY-RUN. Re-run with --apply to delete.')
  process.exit(0)
}

// 3. Back up the current media index locally before touching anything.
const mediaIndex = await readJson('media/_index.json', [])
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
writeFileSync(`media-index-backup-${stamp}.json`, JSON.stringify(mediaIndex, null, 2))
console.log(`\nBacked up media/_index.json -> media-index-backup-${stamp}.json (${mediaIndex.length} entries)`)

// 4. Delete every non-logo media blob.
const urls = remove.map((b) => b.url)
for (let i = 0; i < urls.length; i += 100) {
  await del(urls.slice(i, i + 100), { token })
  console.log(`  deleted ${Math.min(i + 100, urls.length)}/${urls.length}`)
}

// 5. Rewrite media/_index.json to keep only the logo entry (if any).
const keptIndex = mediaIndex.filter((it) => pathOf(it.url) === logoPath)
await put('media/_index.json', JSON.stringify(keptIndex), {
  token, access: 'public', contentType: 'application/json',
  allowOverwrite: true, cacheControlMaxAge: 0,
})
console.log(`\nDone. media/_index.json now has ${keptIndex.length} entry(ies).`)
