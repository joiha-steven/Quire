// One-time migration helper: mirror a legacy Vercel Blob store to the local filesystem
// store used by the native / Docker build. Enumerates EVERY blob (originals + thumbs +
// responsive variants + icons/fonts) and writes each under STORAGE_LOCAL_DIR, preserving
// its pathname. Image refs are stored store-relative, so once the files land under the
// same `media/…` / `files/…` paths, content renders unchanged — no DB rewrite needed.
//
// The app no longer depends on @vercel/blob, so install it ad-hoc to run this:
//   npm i --no-save @vercel/blob
//   BLOB_READ_WRITE_TOKEN=<old token> STORAGE_LOCAL_DIR=/path/to/uploads \
//     node scripts/legacy/blob-to-local.mjs
import { list } from '@vercel/blob'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const DEST = process.env.STORAGE_LOCAL_DIR
if (!DEST || !process.env.BLOB_READ_WRITE_TOKEN) {
  console.error('Set STORAGE_LOCAL_DIR + BLOB_READ_WRITE_TOKEN.')
  process.exit(1)
}

let cursor
let total = 0
let bytes = 0
do {
  const res = await list({ cursor, limit: 1000 })
  for (const b of res.blobs) {
    const out = join(DEST, b.pathname)
    await mkdir(dirname(out), { recursive: true })
    const r = await fetch(b.url)
    if (!r.ok) {
      console.error('FAIL', b.pathname, r.status)
      continue
    }
    const buf = Buffer.from(await r.arrayBuffer())
    await writeFile(out, buf)
    total++
    bytes += buf.length
  }
  cursor = res.cursor
} while (cursor)

console.log(`downloaded ${total} blobs, ${(bytes / 1048576).toFixed(1)} MB → ${DEST}`)
