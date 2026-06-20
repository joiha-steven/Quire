// Read-only audit: check every image link across all posts and report broken ones.
// Covers: markdown image refs, src/href media refs, and the featuredImage frontmatter.
// Both Blob-hosted (media/...) and external (http...) images are HEAD/GET checked.
//   node --env-file=.env.local scripts/check-image-links.mjs
const token = process.env.BLOB_READ_WRITE_TOKEN
const id = token.match(/^vercel_blob_rw_([^_]+)_/)[1]
const BASE = `https://${id}.public.blob.vercel-storage.com`
const get = (p) => fetch(`${BASE}/${p}?ts=${Date.now()}`, { cache: 'no-store' })

// media/... blob pathnames anywhere in the body
const MEDIA_RE = /media\/[^\s")'#\]]+\.(?:jpe?g|png|webp|gif|avif|svg)/gi
// absolute external image URLs in markdown image / src / href positions
const EXT_RE = /\b(https?:\/\/[^\s")'<>]+\.(?:jpe?g|png|webp|gif|avif|svg))/gi
// featuredImage frontmatter value (may be store-relative or absolute)
const FEAT_RE = /^featuredImage:\s*['"]?([^'"\n]+)['"]?\s*$/im

// Probe a URL; treat <400 as OK. Try HEAD, fall back to GET (some hosts 405 HEAD).
async function probe(url) {
  try {
    let r = await fetch(url, { method: 'HEAD', cache: 'no-store', redirect: 'follow' })
    if (r.status === 405 || r.status === 403)
      r = await fetch(url, { method: 'GET', cache: 'no-store', redirect: 'follow' })
    return r.status
  } catch (e) {
    return `ERR ${e.cause?.code || e.message}`
  }
}

const toUrl = (ref) => (/^https?:\/\//.test(ref) ? ref : `${BASE}/${ref.replace(/^\//, '')}`)

const index = await (await get('posts/_index.json')).json()
index.sort((a, b) => new Date(b.date) - new Date(a.date))

const broken = [] // { post, slug, date, ref, status }
let totalRefs = 0
let postsWithImg = 0

for (const p of index) {
  const res = await get(`posts/${p.slug}.md`)
  if (!res.ok) continue
  const raw = await res.text()

  const refs = new Set()
  for (const m of raw.matchAll(MEDIA_RE)) refs.add(m[0])
  for (const m of raw.matchAll(EXT_RE)) refs.add(m[1])
  const feat = raw.match(FEAT_RE)
  if (feat) refs.add(feat[1].trim())
  if (refs.size === 0) continue
  postsWithImg++

  for (const ref of refs) {
    totalRefs++
    const status = await probe(toUrl(ref))
    const ok = typeof status === 'number' && status < 400
    if (!ok) broken.push({ title: p.title, slug: p.slug, date: p.date.slice(0, 10), ref, status })
  }
}

console.log(`\nChecked ${totalRefs} image refs across ${postsWithImg}/${index.length} posts.`)
if (broken.length === 0) {
  console.log('✅ Tất cả link ảnh đều OK.')
} else {
  console.log(`\n❌ ${broken.length} link ảnh LỖI:\n`)
  const byPost = {}
  for (const b of broken) (byPost[b.slug] ??= []).push(b)
  for (const slug of Object.keys(byPost)) {
    const first = byPost[slug][0]
    console.log(`● ${first.title}`)
    console.log(`  /${slug}   (${first.date})`)
    for (const b of byPost[slug]) {
      const kind = /^https?:\/\//.test(b.ref) ? 'EXTERNAL' : 'BLOB'
      console.log(`    [${b.status}] ${kind}  ${b.ref}`)
    }
    console.log('')
  }
}
