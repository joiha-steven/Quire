// Remap broken media/ image refs in posts to the ORIGINAL full-size files on the
// source WordPress site (hosted on Rocket.net), fetched via the Rocket.net file API
// (bypasses any Cloudflare challenge on the public domain). Downloads originals
// (NOT -WxH resized versions), uploads to Blob under media/, rewrites the markdown.
// Needs a /tmp/uploads-index.json built by walking the site's wp-content/uploads.
//   ROCKET_TOKEN=<jwt> ROCKET_SITE=<siteId> \
//     node --env-file=.env.local scripts/remap-original-images.mjs        # dry-run
//   ...same with --apply to download + upload + rewrite.
import { readFileSync } from 'node:fs'
import { put } from '@vercel/blob'

const APPLY = process.argv.includes('--apply')
const T = process.env.ROCKET_TOKEN
const SITE = process.env.ROCKET_SITE // Rocket.net site id (instance value, not tracked)
const blobTok = process.env.BLOB_READ_WRITE_TOKEN
const STORE = blobTok.match(/^vercel_blob_rw_([^_]+)_/)[1]
const BLOB_BASE = `https://${STORE}.public.blob.vercel-storage.com`
const get = (p) => fetch(`${BLOB_BASE}/${p}?ts=${Date.now()}`, { cache: 'no-store' })

const MEDIA_RE = /media\/[^\s")'#\]]+\.(?:jpe?g|png|webp|gif|avif|svg)/gi
const FEAT_RE = /^featuredImage:\s*['"]?([^'"\n]+)['"]?\s*$/im

// uploads image index: [{ rel, name, size }]  rel is relative to wp-content/uploads
const uploads = JSON.parse(readFileSync('/tmp/uploads-index.json', 'utf8'))

// Build stem -> candidate files. stem = name without extension, lowercased.
// A file is a WP resize if its name (pre-ext) ends in -<w>x<h>.
const RESIZE = /-\d+x\d+$/
const byStem = new Map()
for (const f of uploads) {
  const stem = f.name.replace(/\.[^.]+$/, '').toLowerCase()
  if (!byStem.has(stem)) byStem.set(stem, [])
  byStem.get(stem).push(f)
}

// Given a stored ref like media/foo-1024x613.webp, return the ORIGINAL upload file.
function findOriginal(ref) {
  const base = ref.replace(/^media\//, '').replace(/\.[^.]+$/, '') // drop dir + .webp
  const wantStem = base.replace(RESIZE, '').toLowerCase() // strip -WxH if present
  const cands = byStem.get(wantStem)
  if (!cands || cands.length === 0) return null
  // Prefer a non-resize original; among those, the largest by size.
  const originals = cands.filter((f) => !RESIZE.test(f.name.replace(/\.[^.]+$/, '')))
  const pool = originals.length ? originals : cands
  pool.sort((a, b) => b.size - a.size)
  return pool[0]
}

// Rocket.net download wants directory + filename (relative to web root). Returns
// raw file bytes (the application/gzip content-type is misleading; body is raw).
const dl = (rel) => {
  const i = rel.lastIndexOf('/')
  const dir = i === -1 ? '' : rel.slice(0, i)
  const name = i === -1 ? rel : rel.slice(i + 1)
  const qs = `directory=${encodeURIComponent('wp-content/uploads/' + dir)}&filename=${encodeURIComponent(name)}`
  return fetch(`https://api.rocket.net/v1/sites/${SITE}/files/download?${qs}`, {
    headers: { Authorization: `Bearer ${T}` },
  })
}

const CT = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', avif: 'image/avif' }

const index = await (await get('posts/_index.json')).json()
index.sort((a, b) => new Date(b.date) - new Date(a.date))

const plan = [] // { slug, ref, orig, newPath }
const unmatched = []
const refToNew = new Map() // global ref -> new media path (dedupe across posts)

for (const p of index) {
  const res = await get(`posts/${p.slug}.md`)
  if (!res.ok) continue
  let raw = await res.text()
  const refs = new Set([...raw.matchAll(MEDIA_RE)].map((m) => m[0]))
  const feat = raw.match(FEAT_RE)
  if (feat && /^media\//.test(feat[1].trim())) refs.add(feat[1].trim())
  for (const ref of refs) {
    // only act on refs that are currently broken (missing in blob)
    const head = await fetch(`${BLOB_BASE}/${ref}?ts=${Date.now()}`, { method: 'HEAD', cache: 'no-store' })
    if (head.ok) continue
    const orig = findOriginal(ref)
    if (!orig) { unmatched.push({ slug: p.slug, ref }); continue }
    const ext = orig.name.split('.').pop().toLowerCase()
    const newPath = `media/${orig.name}` // keep the ORIGINAL filename + extension
    plan.push({ slug: p.slug, ref, orig: orig.rel, size: orig.size, newPath, ext })
  }
}

console.log(`\nMatched ${plan.length} refs to originals. Unmatched: ${unmatched.length}\n`)
for (const pl of plan)
  console.log(`  ${pl.ref}\n    -> ${pl.orig}  (${(pl.size / 1024).toFixed(0)} KB)  =>  ${pl.newPath}`)
if (unmatched.length) {
  console.log(`\n⚠️  UNMATCHED (no original found):`)
  for (const u of unmatched) console.log(`  ${u.slug}: ${u.ref}`)
}

if (!APPLY) {
  console.log(`\n(dry-run) re-run with --apply to download + upload + rewrite.`)
  process.exit(0)
}

// ---- APPLY ----
// 1. Download each unique original, upload to Blob at its original name.
const uniqueOrig = new Map() // orig.rel -> { newPath, ext }
for (const pl of plan) uniqueOrig.set(pl.orig, { newPath: pl.newPath, ext: pl.ext })
console.log(`\nUploading ${uniqueOrig.size} unique originals to Blob...`)
const uploaded = new Map() // ref -> newPath
for (const [origRel, { newPath, ext }] of uniqueOrig) {
  const r = await dl(origRel)
  if (!r.ok) { console.warn(`  ✗ download failed ${r.status}: ${origRel}`); continue }
  const buf = Buffer.from(await r.arrayBuffer())
  await put(newPath, buf, {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    contentType: CT[ext] || 'application/octet-stream',
  })
  console.log(`  ✓ ${origRel} -> ${newPath} (${(buf.length / 1024).toFixed(0)} KB)`)
}
for (const pl of plan) uploaded.set(pl.ref, pl.newPath)

// 2. Rewrite each post's markdown: ref -> newPath.
const bySlug = new Map()
for (const pl of plan) {
  if (!bySlug.has(pl.slug)) bySlug.set(pl.slug, new Set())
  bySlug.get(pl.slug).add(pl.ref)
}
console.log(`\nRewriting ${bySlug.size} posts...`)
for (const [slug, refs] of bySlug) {
  const res = await get(`posts/${slug}.md`)
  let raw = await res.text()
  for (const ref of refs) {
    const np = uploaded.get(ref)
    if (np && np !== ref) raw = raw.split(ref).join(np)
  }
  await put(`posts/${slug}.md`, raw, {
    access: 'public', addRandomSuffix: false, allowOverwrite: true,
    cacheControlMaxAge: 0, contentType: 'text/markdown',
  })
  console.log(`  ✓ ${slug}`)
}
console.log('\nDone. Verify with: node --env-file=.env.local scripts/check-image-links.mjs')
