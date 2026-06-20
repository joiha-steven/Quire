// One-off: fill width/height on media/_index.json entries that lack them, by
// decoding each original with sharp. New uploads already store dimensions; this
// backfills items from before that (and any svg/gif/webp). Idempotent + additive
// (only sets width/height, never deletes). Dry-run by default.
//   node --env-file=.env.local scripts/backfill-media-dimensions.mjs          # preview
//   node --env-file=.env.local scripts/backfill-media-dimensions.mjs --apply  # write
import { put } from '@vercel/blob'
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')
const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN missing (use --env-file=.env.local)')

const m = token.match(/^vercel_blob_rw_([^_]+)_/)
if (!m) throw new Error('Cannot derive Blob base from token')
const BASE = `https://${m[1]}.public.blob.vercel-storage.com`

// Stored urls are store-relative pathnames ('media/x.jpg'); tolerate absolute too.
const pathOf = (u) => {
  if (/^https?:\/\//.test(u)) {
    try { return new URL(u).pathname.replace(/^\//, '') } catch { return '' }
  }
  return u.replace(/^\//, '')
}
const fresh = (p) => `${BASE}/${p}?ts=${Date.now()}`

const index = await (await fetch(fresh('media/_index.json'), { cache: 'no-store' })).json()
const pending = index.filter((it) => !(it.width && it.height))
console.log(`media items: ${index.length} · missing dimensions: ${pending.length}`)

let filled = 0
for (const it of pending) {
  const p = pathOf(it.url)
  try {
    const res = await fetch(fresh(p), { cache: 'no-store' })
    if (!res.ok) { console.log(`  skip (${res.status}): ${p}`); continue }
    const buf = Buffer.from(await res.arrayBuffer())
    const meta = await sharp(buf, { failOn: 'none' }).rotate().metadata()
    if (meta.width && meta.height) {
      it.width = meta.width
      it.height = meta.height
      filled++
      console.log(`  ${meta.width}×${meta.height}  ${p}`)
    } else {
      console.log(`  no dims: ${p}`)
    }
  } catch (e) {
    console.log(`  error: ${p} — ${e.message}`)
  }
}

console.log(`\nfilled: ${filled}/${pending.length}`)
if (!APPLY) { console.log('DRY-RUN. Re-run with --apply to write the index.'); process.exit(0) }
if (filled === 0) { console.log('Nothing to write.'); process.exit(0) }

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
writeFileSync(`media-index-backup-${stamp}.json`, JSON.stringify(index, null, 2))
console.log(`Backed up -> media-index-backup-${stamp}.json`)

await put('media/_index.json', JSON.stringify(index, null, 2), {
  token, access: 'public', contentType: 'application/json',
  allowOverwrite: true, cacheControlMaxAge: 0,
})
console.log('Wrote media/_index.json')
