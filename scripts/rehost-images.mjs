// Rehost external images referenced in imported content onto vibeblog's Blob.
//
// Scans every posts/*.md and pages/*.md in Blob for image URLs on a given host,
// downloads each (browser-like headers, to pass bot protection), optimizes it
// (sharp -> WebP, cap 1600px) and re-uploads to media/. Then rewrites the URL in
// the markdown bodies and appends the files to media/_index.json. Idempotent:
// each source URL is fetched once and re-runs only touch still-external URLs.
//
// Usage:
//   BLOB_READ_WRITE_TOKEN=... node scripts/rehost-images.mjs [host] [--dry]
//   (host defaults to manhhung.me)

import { put, list } from '@vercel/blob'
import sharp from 'sharp'

const [, , ...args] = process.argv
const DRY = args.includes('--dry')
const HOST = args.find((a) => !a.startsWith('--')) || 'manhhung.me'
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) {
  console.error('Missing BLOB_READ_WRITE_TOKEN.')
  process.exit(1)
}

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/png,image/*,*/*',
  Referer: 'https://vibeblog-mocha.vercel.app/',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Mode': 'no-cors',
  'Sec-Fetch-Site': 'cross-site',
}

const MAX_WIDTH = 1600
const OPTIMIZABLE = /^image\/(jpeg|png|webp|avif|tiff|bmp)$/
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const slugify = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s.-]/g, '')
    .replace(/[\s]+/g, '-')
    .replace(/^-+|-+$/g, '')

async function listMarkdown() {
  const out = []
  for (const prefix of ['posts/', 'pages/']) {
    let cursor
    do {
      const res = await list({ prefix, cursor, limit: 1000, token: TOKEN })
      for (const b of res.blobs) if (b.pathname.endsWith('.md')) out.push(b)
      cursor = res.cursor
    } while (cursor)
  }
  return out
}

async function readBlobJson(pathname, fallback) {
  const { blobs } = await list({ prefix: pathname, limit: 1, token: TOKEN })
  const hit = blobs.find((b) => b.pathname === pathname)
  if (!hit) return fallback
  const res = await fetch(hit.url, { cache: 'no-store' })
  return res.ok ? await res.json() : fallback
}

const putBlob = (pathname, body, contentType) =>
  put(pathname, body, { access: 'public', addRandomSuffix: false, allowOverwrite: true, contentType, token: TOKEN })

const taken = new Set()
function freePathname(base, ext) {
  const make = (n) => `media/${n === 1 ? base : `${base}-${n}`}.${ext}`
  let n = 1
  while (taken.has(make(n))) n++
  const p = make(n)
  taken.add(p)
  return p
}

const media = []

// Download one URL, optimize, upload. Returns the new Blob URL or null on failure.
async function rehost(url) {
  try {
    const res = await fetch(url, { headers: HEADERS })
    const ctype = res.headers.get('content-type') || ''
    if (!res.ok || !ctype.startsWith('image/')) {
      console.warn(`  skip (${res.status} ${ctype}) ${url}`)
      return null
    }
    const buf = Buffer.from(await res.arrayBuffer())
    const namePart = decodeURIComponent(new URL(url).pathname.split('/').pop() || 'image')
    const dot = namePart.lastIndexOf('.')
    let base = slugify(dot >= 0 ? namePart.slice(0, dot) : namePart) || 'image'
    base = base.replace(/\.+$/, '')

    let data = buf
    let ext = (dot >= 0 ? namePart.slice(dot + 1) : 'bin').toLowerCase()
    let type = ctype
    if (OPTIMIZABLE.test(ctype)) {
      const img = sharp(buf, { failOn: 'none' }).rotate()
      const meta = await img.metadata()
      if ((meta.width ?? 0) > MAX_WIDTH) img.resize({ width: MAX_WIDTH })
      data = await img.webp({ quality: 80 }).toBuffer()
      ext = 'webp'
      type = 'image/webp'
    }
    const pathname = freePathname(base, ext)
    const { url: newUrl } = await putBlob(pathname, data, type)
    media.push({ url: newUrl, filename: pathname.replace(/^media\//, ''), size: data.byteLength, uploadedAt: new Date().toISOString() })
    return newUrl
  } catch (e) {
    console.warn(`  error ${url}: ${e.message}`)
    return null
  }
}

// --- run -------------------------------------------------------------------

const mds = await listMarkdown()
const urlRe = new RegExp(`https?://${HOST.replace('.', '\\.')}/wp-content/uploads/[^\\s")'<>]+`, 'g')

// Collect unique URLs across all files first.
const fileTexts = new Map()
const allUrls = new Set()
for (const b of mds) {
  const text = await (await fetch(b.url, { cache: 'no-store' })).text()
  fileTexts.set(b.pathname, text)
  for (const m of text.matchAll(urlRe)) allUrls.add(m[0].replace(/[).,]+$/, ''))
}
console.log(`Found ${allUrls.size} unique image URLs across ${mds.length} markdown files.`)

if (DRY) {
  ;[...allUrls].slice(0, 20).forEach((u) => console.log('  ' + u))
  console.log('Dry run: nothing downloaded or written.')
  process.exit(0)
}

const map = new Map()
let i = 0
for (const url of allUrls) {
  i++
  process.stdout.write(`[${i}/${allUrls.size}] ${url.slice(-60)} ... `)
  const newUrl = await rehost(url)
  if (newUrl) {
    map.set(url, newUrl)
    console.log('ok')
  }
  await sleep(150) // be gentle with the origin
}

let filesChanged = 0
for (const [pathname, original] of fileTexts) {
  let text = original
  for (const [oldUrl, newUrl] of map) text = text.split(oldUrl).join(newUrl)
  if (text !== original) {
    await putBlob(pathname, text, 'text/markdown')
    filesChanged++
  }
}

if (media.length) {
  const idx = await readBlobJson('media/_index.json', [])
  await putBlob('media/_index.json', JSON.stringify([...media, ...idx], null, 2), 'application/json')
}

console.log(`Done. Rehosted ${map.size}/${allUrls.size} images, rewrote ${filesChanged} files.`)
