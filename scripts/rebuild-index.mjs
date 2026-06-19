// Rebuild posts/_index.json and pages/_index.json from the actual .md files.
// The _index.json is the query layer; if it ever gets clobbered (e.g. a stale
// read during save overwrites it), the listing loses posts even though the .md
// bodies survive. This re-derives the index from the source of truth (.md).
//
// Usage:
//   node --env-file=../vibeblog-private/.env.local scripts/rebuild-index.mjs [--dry]

import { list, put } from '@vercel/blob'
import matter from 'gray-matter'

const DRY = process.argv.includes('--dry')
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) { console.error('Missing BLOB_READ_WRITE_TOKEN'); process.exit(1) }

function deriveExcerpt(md, maxWords = 50) {
  const plain = md
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!plain) return undefined
  const w = plain.split(' ')
  return w.length <= maxWords ? plain : `${w.slice(0, maxWords).join(' ')}...`
}

const clean = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined))

async function read(url) {
  return (await fetch(`${url}?ts=${Date.now()}`, { cache: 'no-store' })).text()
}

async function rebuild(prefix, kind) {
  const { blobs } = await list({ prefix, token: TOKEN, limit: 1000 })
  const mds = blobs.filter((b) => b.pathname.endsWith('.md'))
  const entries = []
  for (const b of mds) {
    const slug = b.pathname.slice(prefix.length, -3)
    const { data, content } = matter(await read(b.url))
    if (kind === 'post') {
      entries.push(clean({
        title: data.title ?? slug,
        slug: data.slug ?? slug,
        date: data.date ?? new Date().toISOString(),
        status: data.status === 'published' ? 'published' : 'draft',
        categories: data.categories ?? [],
        tags: data.tags ?? [],
        featuredImage: data.featuredImage,
        excerpt: data.excerpt ?? deriveExcerpt(content),
      }))
    } else {
      entries.push(clean({
        title: data.title ?? slug,
        slug: data.slug ?? slug,
        status: data.status === 'published' ? 'published' : 'draft',
        featuredImage: data.featuredImage,
      }))
    }
  }
  if (kind === 'post') entries.sort((a, b) => new Date(b.date) - new Date(a.date))
  else entries.sort((a, b) => a.title.localeCompare(b.title))

  console.log(`${prefix}_index.json: ${entries.length} ${kind}s (from ${mds.length} .md)`)
  if (!DRY) {
    await put(`${prefix}_index.json`, JSON.stringify(entries, null, 2), {
      access: 'public', addRandomSuffix: false, allowOverwrite: true,
      contentType: 'application/json', cacheControlMaxAge: 0, token: TOKEN,
    })
  }
}

await rebuild('posts/', 'post')
await rebuild('pages/', 'page')
console.log(DRY ? 'DRY: nothing written.' : 'Done.')
