// Backfill missing excerpts for posts (e.g. imported ones). For every post with
// no excerpt, derive one from the body (first 50 words) and write it into both
// posts/{slug}.md and posts/_index.json. Idempotent.
//
// Usage: BLOB_READ_WRITE_TOKEN=... node scripts/backfill-excerpts.mjs [--dry]

import { put, list } from '@vercel/blob'
import matter from 'gray-matter'

const DRY = process.argv.includes('--dry')
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) {
  console.error('Missing BLOB_READ_WRITE_TOKEN.')
  process.exit(1)
}

// Mirror lib/utils deriveExcerpt: strip markdown/HTML, first 50 words + "...".
function toPlainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
function deriveExcerpt(md, maxWords = 50) {
  const plain = toPlainText(md)
  if (!plain) return ''
  const words = plain.split(' ')
  return words.length <= maxWords ? plain : `${words.slice(0, maxWords).join(' ')}...`
}

async function readJson(pathname, fallback) {
  const { blobs } = await list({ prefix: pathname, limit: 1, token: TOKEN })
  const hit = blobs.find((b) => b.pathname === pathname)
  if (!hit) return fallback
  const res = await fetch(hit.url, { cache: 'no-store' })
  return res.ok ? await res.json() : fallback
}
async function readText(url) {
  const res = await fetch(url, { cache: 'no-store' })
  return res.ok ? await res.text() : null
}
const putBlob = (pathname, body, contentType) =>
  put(pathname, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType, token: TOKEN })

// Map slug -> md blob url.
const mdUrls = new Map()
let cursor
do {
  const res = await list({ prefix: 'posts/', cursor, limit: 1000, token: TOKEN })
  for (const b of res.blobs) if (b.pathname.endsWith('.md')) mdUrls.set(b.pathname.replace(/^posts\/|\.md$/g, ''), b.url)
  cursor = res.cursor
} while (cursor)

const index = await readJson('posts/_index.json', [])
let changed = 0

for (const meta of index) {
  if (meta.excerpt && meta.excerpt.trim()) continue
  const url = mdUrls.get(meta.slug)
  if (!url) continue
  const raw = await readText(url)
  if (raw == null) continue
  const { data, content } = matter(raw)
  const excerpt = deriveExcerpt(content.trim())
  if (!excerpt) continue
  meta.excerpt = excerpt
  console.log(`  ${meta.slug}: ${excerpt.slice(0, 60)}...`)
  if (!DRY) {
    const clean = Object.fromEntries(Object.entries({ ...data, excerpt }).filter(([, v]) => v !== undefined))
    await putBlob(`posts/${meta.slug}.md`, matter.stringify(content, clean), 'text/markdown')
  }
  changed++
}

if (DRY) {
  console.log(`Dry run: ${changed} posts would get an excerpt.`)
  process.exit(0)
}
if (changed) await putBlob('posts/_index.json', JSON.stringify(index, null, 2), 'application/json')
console.log(`Done. Backfilled ${changed} excerpts.`)
