// Read-only report: which posts reference images, and the image pathnames.
// Helps re-upload originals by hand.  node --env-file=.env.local scripts/list-posts-with-images.mjs
const token = process.env.BLOB_READ_WRITE_TOKEN
const id = token.match(/^vercel_blob_rw_([^_]+)_/)[1]
const BASE = `https://${id}.public.blob.vercel-storage.com`
const get = (p) => fetch(`${BASE}/${p}?ts=${Date.now()}`, { cache: 'no-store' })

const IMG_RE = /media\/[^\s")'#\]]+\.(?:jpe?g|png|webp|gif|avif|svg)/gi

const index = await (await get('posts/_index.json')).json()
// newest first
index.sort((a, b) => new Date(b.date) - new Date(a.date))

let withImages = 0
const lines = []
for (const p of index) {
  const res = await get(`posts/${p.slug}.md`)
  if (!res.ok) continue
  const raw = await res.text()
  const imgs = [...new Set([...raw.matchAll(IMG_RE)].map((m) => m[0]))]
  if (imgs.length === 0) continue
  withImages++
  lines.push(`\n● ${p.title}`)
  lines.push(`  /${p.slug}   (${p.date.slice(0, 10)})   ${imgs.length} ảnh`)
  for (const i of imgs) lines.push(`    - ${i.replace(/^media\//, '')}`)
}

console.log(`${withImages}/${index.length} bài có ảnh:`)
console.log(lines.join('\n'))
