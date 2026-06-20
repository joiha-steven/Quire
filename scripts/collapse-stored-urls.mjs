// One-time: rewrite every stored Blob URL (any store host) -> store-relative
// pathname in all JSON + Markdown blobs of the current store
// (BLOB_READ_WRITE_TOKEN). Makes content store-agnostic. Idempotent.
//   node --env-file=.env.local scripts/collapse-stored-urls.mjs [--apply]
import { list, put } from '@vercel/blob'

const APPLY = process.argv.includes('--apply')
const token = process.env.BLOB_READ_WRITE_TOKEN
if (!token) throw new Error('BLOB_READ_WRITE_TOKEN missing')
const id = token.match(/^vercel_blob_rw_([^_]+)_/)?.[1]
console.log(`Store: ${id}  (${APPLY ? 'APPLY' : 'dry-run'})\n`)

const HOST_RE = /https?:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//gi
const isText = (p) => p.endsWith('.json') || p.endsWith('.md')

let cursor, all = []
do {
  const page = await list({ token, cursor, limit: 1000 })
  all.push(...page.blobs)
  cursor = page.cursor
} while (cursor)

let changed = 0
for (const b of all.filter((x) => isText(x.pathname))) {
  const res = await fetch(`${b.url}?ts=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) { console.log(`  SKIP read ${res.status}: ${b.pathname}`); continue }
  const text = await res.text()
  const next = text.replace(HOST_RE, '')
  if (next === text) continue
  const hits = (text.match(HOST_RE) || []).length
  console.log(`  ${APPLY ? 'rewrite' : 'would rewrite'} ${b.pathname}  (${hits} url${hits > 1 ? 's' : ''})`)
  changed++
  if (APPLY) {
    await put(b.pathname, next, {
      token, access: 'public',
      contentType: b.pathname.endsWith('.json') ? 'application/json' : 'text/markdown',
      addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 0,
    })
  }
}
console.log(`\n${APPLY ? 'Rewrote' : 'Would rewrite'} ${changed} file(s).${APPLY ? '' : ' Re-run with --apply.'}`)
