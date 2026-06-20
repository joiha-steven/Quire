// Copy every blob from the source store (BLOB_READ_WRITE_TOKEN) to the
// destination store (DST_BLOB_TOKEN). Non-destructive: the source is untouched.
//   DST_BLOB_TOKEN="vercel_blob_rw_..." \
//     node --env-file=.env.local scripts/copy-blob-store.mjs
import { list, put } from '@vercel/blob'

const SRC = process.env.BLOB_READ_WRITE_TOKEN
const DST = process.env.DST_BLOB_TOKEN
if (!SRC || !DST) throw new Error('Need BLOB_READ_WRITE_TOKEN (src) + DST_BLOB_TOKEN (dst)')
if (SRC === DST) throw new Error('Source and destination tokens are identical')

const srcId = SRC.match(/^vercel_blob_rw_([^_]+)_/)?.[1]
const dstId = DST.match(/^vercel_blob_rw_([^_]+)_/)?.[1]
console.log(`Source store: ${srcId}\nDest store:   ${dstId}\n`)

// Mutable manifests/markdown must not be CDN-cached; media images cache 1 year.
const cacheFor = (p) =>
  p.startsWith('media/') && p !== 'media/_index.json' ? 31536000 : 0

let cursor, all = []
do {
  const page = await list({ token: SRC, cursor, limit: 1000 })
  all.push(...page.blobs)
  cursor = page.cursor
} while (cursor)

console.log(`Found ${all.length} blobs to copy.\n`)
let n = 0
for (const b of all) {
  const res = await fetch(`${b.url}?ts=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) { console.log(`  SKIP (read ${res.status}): ${b.pathname}`); continue }
  const buf = Buffer.from(await res.arrayBuffer())
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  await put(b.pathname, buf, {
    token: DST,
    access: 'public',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: cacheFor(b.pathname),
  })
  console.log(`  copied (${++n}/${all.length}): ${b.pathname}`)
}
console.log(`\nDone. Copied ${n}/${all.length} blobs to ${dstId}.`)
