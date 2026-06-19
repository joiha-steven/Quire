// Import a WordPress export (WXR .xml) into vibeblog's Blob store.
//
// Converts each published/draft post -> posts/{slug}.md (+ posts/_index.json)
// and each page -> pages/{slug}.md (+ pages/_index.json). HTML body is converted
// to Markdown; categories, tags and dates are preserved. Image URLs are kept
// as-is (pointing at the old site) unless --rehost is added later.
//
// Usage:
//   BLOB_READ_WRITE_TOKEN=... node scripts/import-wordpress.mjs export.xml [--dry]
//
// Get export.xml from WordPress admin -> Tools -> Export -> All content.

import { readFile } from 'node:fs/promises'
import { put, list } from '@vercel/blob'
import matter from 'gray-matter'
import { XMLParser } from 'fast-xml-parser'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const [, , xmlPath, ...flags] = process.argv
const DRY = flags.includes('--dry')
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN

if (!xmlPath) {
  console.error('Usage: node scripts/import-wordpress.mjs export.xml [--dry]')
  process.exit(1)
}
if (!TOKEN && !DRY) {
  console.error('Missing BLOB_READ_WRITE_TOKEN (export it or run with --dry).')
  process.exit(1)
}

const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
td.use(gfm)

// --- helpers ---------------------------------------------------------------

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v])
const text = (v) => (v == null ? '' : typeof v === 'object' ? (v['#text'] ?? '') : String(v))

function toIso(wpDate, fallback) {
  const s = text(wpDate)
  if (!s || s.startsWith('0000')) return fallback
  const d = new Date(s.replace(' ', 'T') + 'Z')
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString()
}

function serialize(frontmatter, body) {
  const clean = Object.fromEntries(Object.entries(frontmatter).filter(([, v]) => v !== undefined))
  return matter.stringify(body ?? '', clean)
}

async function readJson(pathname, fallback) {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1, token: TOKEN })
    const hit = blobs.find((b) => b.pathname === pathname)
    if (!hit) return fallback
    const res = await fetch(hit.url, { cache: 'no-store' })
    return res.ok ? await res.json() : fallback
  } catch {
    return fallback
  }
}

const writeJson = (pathname, data) =>
  put(pathname, JSON.stringify(data, null, 2), {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token: TOKEN,
  })

const writeText = (pathname, body) =>
  put(pathname, body, {
    access: 'public',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'text/markdown',
    token: TOKEN,
  })

// --- parse -----------------------------------------------------------------

const xml = await readFile(xmlPath, 'utf8')
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', trimValues: false })
const doc = parser.parse(xml)
const items = asArray(doc?.rss?.channel?.item)
console.log(`Parsed ${items.length} items from ${xmlPath}`)

const used = new Set()
function uniqueSlug(base) {
  let slug = base || 'untitled'
  let n = 2
  while (used.has(slug)) slug = `${base}-${n++}`
  used.add(slug)
  return slug
}

const posts = []
const pages = []
let skipped = 0

for (const item of items) {
  const type = text(item['wp:post_type'])
  const status = text(item['wp:status'])
  if (type !== 'post' && type !== 'page') {
    skipped++
    continue
  }
  if (!['publish', 'draft', 'pending', 'private'].includes(status)) {
    skipped++
    continue
  }

  const title = text(item.title).trim() || '(không tiêu đề)'
  const base = slugify(text(item['wp:post_name']) || title)
  const slug = uniqueSlug(base)
  const date = toIso(item['wp:post_date_gmt'] ?? item['wp:post_date'], new Date().toISOString())
  const html = text(item['content:encoded'])
  const body = html ? td.turndown(html).trim() : ''
  const excerptRaw = text(item['excerpt:encoded']).trim()
  const mappedStatus = status === 'publish' ? 'published' : 'draft'

  if (type === 'page') {
    pages.push({ meta: { title, slug, status: mappedStatus }, body })
    continue
  }

  const cats = []
  const tags = []
  for (const c of asArray(item.category)) {
    const label = text(c).trim()
    if (!label) continue
    if (c['@_domain'] === 'post_tag') tags.push(label)
    else if (c['@_domain'] === 'category') cats.push(label)
  }
  posts.push({
    meta: {
      title,
      slug,
      date,
      status: mappedStatus,
      categories: [...new Set(cats)],
      tags: [...new Set(tags)],
      excerpt: excerptRaw || undefined,
    },
    body,
  })
}

console.log(`-> ${posts.length} posts, ${pages.length} pages (skipped ${skipped} other/attachment/trashed)`)

if (DRY) {
  for (const p of [...posts, ...pages].slice(0, 10)) {
    console.log(`   ${p.meta.status.padEnd(9)} /${p.meta.slug}  —  ${p.meta.title}`)
  }
  console.log('Dry run: nothing written. Re-run without --dry to import.')
  process.exit(0)
}

// --- write -----------------------------------------------------------------

const postIndex = await readJson('posts/_index.json', [])
const pageIndex = await readJson('pages/_index.json', [])

for (const p of posts) {
  await writeText(`posts/${p.meta.slug}.md`, serialize(p.meta, p.body))
  const i = postIndex.findIndex((x) => x.slug === p.meta.slug)
  if (i >= 0) postIndex[i] = p.meta
  else postIndex.push(p.meta)
  console.log(`  post  /${p.meta.slug}`)
}
for (const p of pages) {
  await writeText(`pages/${p.meta.slug}.md`, serialize(p.meta, p.body))
  const i = pageIndex.findIndex((x) => x.slug === p.meta.slug)
  if (i >= 0) pageIndex[i] = p.meta
  else pageIndex.push(p.meta)
  console.log(`  page  /${p.meta.slug}`)
}

await writeJson('posts/_index.json', postIndex)
await writeJson('pages/_index.json', pageIndex)

console.log(`Done. Imported ${posts.length} posts + ${pages.length} pages into Blob.`)
console.log('Note: image URLs still point at the old site; rehost to Blob later if needed.')
