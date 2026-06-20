// One-off: fill `readingMinutes` on every posts/_index.json entry from its body,
// so the blog list can show read time for posts saved before the field existed.
// New saves compute it automatically (lib/posts.ts#toMeta). Idempotent.
//   node --env-file=.env.local scripts/backfill-reading-time.mjs [--dry]
import { put } from '@vercel/blob'

const token = process.env.BLOB_READ_WRITE_TOKEN
const id = token.match(/^vercel_blob_rw_([^_]+)_/)[1]
const BASE = `https://${id}.public.blob.vercel-storage.com`
const DRY = process.argv.includes('--dry')
const get = (p) => fetch(`${BASE}/${p}?ts=${Date.now()}`, { cache: 'no-store' })

// Mirror of lib/utils readingMinutes: ~200 words/min, floor of 1.
function readingMinutes(markdown) {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]/g, ' ')
  const words = plain.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200))
}

const index = await (await get('posts/_index.json')).json()
let changed = 0
for (const p of index) {
  const res = await get(`posts/${p.slug}.md`)
  if (!res.ok) continue
  const raw = await res.text()
  const body = raw.replace(/^---[\s\S]*?---\s*/, '') // drop frontmatter
  const minutes = readingMinutes(body)
  if (p.readingMinutes !== minutes) {
    console.log(`${p.slug}: ${p.readingMinutes ?? '-'} -> ${minutes}`)
    p.readingMinutes = minutes
    changed++
  }
}

console.log(`\n${changed} entr${changed === 1 ? 'y' : 'ies'} updated${DRY ? ' (dry run)' : ''}.`)
if (changed && !DRY) {
  await put('posts/_index.json', JSON.stringify(index, null, 2), {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: 'application/json', cacheControlMaxAge: 0,
  })
  console.log('posts/_index.json written.')
}
