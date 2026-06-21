// One-off: migrate all TEXT content from Vercel Blob into Supabase Postgres.
// Binaries (images/files) stay on Blob — only the manifests + .md bodies move.
//
//   node --env-file=.env.local scripts/migrate-to-supabase.mjs [--dry]
//
// Reads (from Blob): posts/_index.json + posts/{slug}.md, pages/_index.json +
// pages/{slug}.md, revisions/{slug}.json, media/_index.json, files/_index.json,
// settings/site.json. Writes (to Postgres): posts, pages, post_revisions, media,
// files, settings. Idempotent: posts/pages/media/files/settings upsert by PK;
// a post's revisions are replaced wholesale. Run with --dry to preview counts.

import matter from 'gray-matter'
import { createClient } from '@supabase/supabase-js'

const DRY = process.argv.includes('--dry')

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!BLOB_TOKEN) throw new Error('Missing BLOB_READ_WRITE_TOKEN')
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')

const storeId = BLOB_TOKEN.match(/^vercel_blob_rw_([^_]+)_/)?.[1]
if (!storeId) throw new Error('Cannot derive Blob store id from token')
const BLOB_BASE = `https://${storeId}.public.blob.vercel-storage.com`

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Cache-busted reads of mutable Blob JSON/markdown (same as the old data layer).
const fresh = (p) => `${BLOB_BASE}/${p}?ts=${Date.now()}`
async function readJson(path, fallback) {
  const res = await fetch(fresh(path), { cache: 'no-store' })
  return res.ok ? res.json() : fallback
}
async function readText(path) {
  const res = await fetch(fresh(path), { cache: 'no-store' })
  return res.ok ? res.text() : null
}

// Strip any Blob host (store or vanity) -> store-relative pathname. Bodies in .md
// are already collapsed, but revision snapshots stored absolute URLs.
const HOST_RE = /https?:\/\/(?:[a-z0-9-]+\.public\.blob\.vercel-storage\.com|files\.manhhung\.me)\//gi
const collapse = (s) => (typeof s === 'string' ? s.replace(HOST_RE, '') : s)

function parseMd(raw, slug) {
  const { data, content } = matter(raw)
  return { data, body: collapse(content.trim()), slug: data.slug ?? slug }
}

async function migratePosts() {
  const index = await readJson('posts/_index.json', [])
  const rows = []
  const revisionsBySlug = {}
  for (const meta of index) {
    const raw = await readText(`posts/${meta.slug}.md`)
    if (!raw) { console.warn(`  ! missing posts/${meta.slug}.md — skipped`); continue }
    const { data, body } = parseMd(raw, meta.slug)
    rows.push({
      slug: data.slug ?? meta.slug,
      title: data.title ?? meta.slug,
      date: data.date ?? new Date().toISOString(),
      status: data.status === 'published' ? 'published' : 'draft',
      categories: data.categories ?? [],
      tags: data.tags ?? [],
      featured_image: collapse(data.featuredImage) ?? null,
      excerpt: data.excerpt ?? null,
      reading_minutes: data.readingMinutes ?? null,
      content: body,
    })
    const revs = await readJson(`revisions/${meta.slug}.json`, [])
    if (revs.length) {
      revisionsBySlug[data.slug ?? meta.slug] = revs.map((r) => ({
        slug: data.slug ?? meta.slug,
        saved_at: r.savedAt ?? new Date().toISOString(),
        data: {
          title: r.title,
          slug: r.slug,
          date: r.date,
          status: r.status,
          categories: r.categories ?? [],
          tags: r.tags ?? [],
          featuredImage: collapse(r.featuredImage),
          excerpt: r.excerpt,
          content: collapse(r.content ?? ''),
        },
      }))
    }
  }
  const revRows = Object.values(revisionsBySlug).flat()
  console.log(`posts: ${rows.length}  revisions: ${revRows.length}`)
  if (DRY) return
  if (rows.length) {
    const { error } = await db.from('posts').upsert(rows)
    if (error) throw new Error(`posts upsert: ${error.message}`)
  }
  for (const [slug, revs] of Object.entries(revisionsBySlug)) {
    await db.from('post_revisions').delete().eq('slug', slug)
    const { error } = await db.from('post_revisions').insert(revs)
    if (error) throw new Error(`revisions insert (${slug}): ${error.message}`)
  }
}

async function migratePages() {
  const index = await readJson('pages/_index.json', [])
  const rows = []
  for (const meta of index) {
    const raw = await readText(`pages/${meta.slug}.md`)
    if (!raw) { console.warn(`  ! missing pages/${meta.slug}.md — skipped`); continue }
    const { data, body } = parseMd(raw, meta.slug)
    rows.push({
      slug: data.slug ?? meta.slug,
      title: data.title ?? meta.slug,
      status: data.status === 'published' ? 'published' : 'draft',
      featured_image: collapse(data.featuredImage) ?? null,
      content: body,
    })
  }
  console.log(`pages: ${rows.length}`)
  if (DRY || !rows.length) return
  const { error } = await db.from('pages').upsert(rows)
  if (error) throw new Error(`pages upsert: ${error.message}`)
}

async function migrateMedia() {
  const index = await readJson('media/_index.json', [])
  const rows = index.map((m) => ({
    path: collapse(m.url),
    filename: m.filename,
    size: m.size ?? 0,
    uploaded_at: m.uploadedAt ?? new Date().toISOString(),
    width: m.width ?? null,
    height: m.height ?? null,
    thumb: m.thumb ? collapse(m.thumb) : null,
    variants: !!m.variants,
  }))
  console.log(`media: ${rows.length}`)
  if (DRY || !rows.length) return
  const { error } = await db.from('media').upsert(rows)
  if (error) throw new Error(`media upsert: ${error.message}`)
}

async function migrateFiles() {
  const index = await readJson('files/_index.json', [])
  const rows = index.map((f) => ({
    url: collapse(f.url),
    filename: f.filename,
    size: f.size ?? 0,
    content_type: f.contentType ?? 'application/octet-stream',
    uploaded_at: f.uploadedAt ?? new Date().toISOString(),
  }))
  console.log(`files: ${rows.length}`)
  if (DRY || !rows.length) return
  const { error } = await db.from('files').upsert(rows)
  if (error) throw new Error(`files upsert: ${error.message}`)
}

async function migrateSettings() {
  const stored = await readJson('settings/site.json', null)
  console.log(`settings: ${stored ? 'present' : 'none (defaults will apply)'}`)
  if (DRY || !stored) return
  const { error } = await db.from('settings').upsert({ id: 1, data: stored })
  if (error) throw new Error(`settings upsert: ${error.message}`)
}

async function verify() {
  for (const t of ['posts', 'pages', 'post_revisions', 'media', 'files', 'settings']) {
    const { count } = await db.from(t).select('*', { count: 'exact', head: true })
    console.log(`  ${t}: ${count} rows`)
  }
}

console.log(DRY ? '— DRY RUN (no writes) —' : '— MIGRATING Blob -> Supabase —')
await migratePosts()
await migratePages()
await migrateMedia()
await migrateFiles()
await migrateSettings()
if (!DRY) {
  console.log('\nVerify (row counts in Postgres):')
  await verify()
}
console.log('\nDone.')
