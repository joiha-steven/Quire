// Media data access. Metadata lives in the Postgres `media` table; the binaries
// (original + responsive variants + thumbnail) live on Vercel Blob.
// Raster photos (jpg/png) keep the untouched ORIGINAL plus generated responsive
// variants: -1024 / -1600 in both AVIF and WebP, and a -thumb.webp for the
// library. Vector/animation/webp (svg/gif/webp — logos, icons) are stored as-is.
// Variant URLs are derived by convention from the original's name.

import sharp from 'sharp'
import { cache } from 'react'
import type { MediaItem } from '@/types'
import {
  uploadFile, blobUrl, deleteByPathname, collapseBlob, expandBlob, listBlobs,
} from '@/lib/blob'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'

const RASTER = /^image\/(jpeg|png)$/ // full responsive pipeline
const PASSTHROUGH = /^image\/(svg\+xml|gif|webp)$/ // stored as-is, no variants
const SIZES = [1024, 1600] as const // display widths (in-column / wider)
const THUMB_WIDTH = 400

// A row as stored in Postgres (store-relative paths).
type MediaRow = {
  path: string
  filename: string
  size: number
  uploaded_at: string
  width: number | null
  height: number | null
  thumb: string | null
  variants: boolean
}

// Row -> client item (absolute URLs).
function rowToItem(row: MediaRow): MediaItem {
  return {
    url: expandBlob(row.path),
    filename: row.filename,
    size: Number(row.size),
    uploadedAt: row.uploaded_at,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    thumb: row.thumb ? expandBlob(row.thumb) : undefined,
    variants: row.variants,
  }
}

// Non-cached read of the whole library, newest first. Used directly by the
// mutating helpers so they return the authoritative current state.
async function listMedia(): Promise<MediaItem[]> {
  try {
    const { data, error } = await db()
      .from('media')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] media.listMedia: ${error.message}`)
      return []
    }
    return (data as MediaRow[]).map(rowToItem)
  } catch (error) {
    console.error(`[ERROR] media.listMedia: ${(error as Error).message}`)
    return []
  }
}

// Library list, newest first. `React.cache` dedupes within one render; every
// fresh request re-reads Postgres, so a deleted image is gone the moment you
// reopen the library and a new upload appears at once.
export const getMedia = cache(listMedia)

type Variant = { suffix: string; data: Buffer; contentType: string }

// From the original bytes, read pixel dimensions (auto-oriented).
async function imageSize(original: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(original, { failOn: 'none' }).rotate().metadata()
  return { width: meta.width ?? 0, height: meta.height ?? 0 }
}

// Pixel dimensions for any image we can decode (raster + webp/gif, and most svg).
async function safeSize(buf: Buffer): Promise<{ width?: number; height?: number }> {
  try {
    const { width, height } = await imageSize(buf)
    return width && height ? { width, height } : {}
  } catch {
    return {}
  }
}

// Small library thumbnail — cheap, made on upload so the grid renders at once.
async function makeThumb(original: Buffer): Promise<Buffer> {
  return sharp(original, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()
}

// The heavy display set (AVIF + WebP @ each size) — deferred to AFTER save so the
// save request never blocks on the AVIF encode (the original always renders).
async function makeDisplay(original: Buffer): Promise<Variant[]> {
  const { width: ow } = await imageSize(original)
  const files: Variant[] = []
  for (const w of SIZES) {
    const pipe = sharp(original, { failOn: 'none' })
      .rotate()
      .resize({ width: ow ? Math.min(w, ow) : w, withoutEnlargement: true })
    files.push({ suffix: `-${w}.webp`, data: await pipe.clone().webp({ quality: 80 }).toBuffer(), contentType: 'image/webp' })
    files.push({ suffix: `-${w}.avif`, data: await pipe.clone().avif({ quality: 50 }).toBuffer(), contentType: 'image/avif' })
  }
  return files
}

// All media pathnames already taken, for collision-free naming. Unions the DB
// metadata with the ACTUAL store contents (listBlobs) so a name is never reused —
// covers the derived thumb/variant names (which are not separate rows).
async function takenPathnames(): Promise<Set<string>> {
  const set = new Set<string>()
  const { data } = await db().from('media').select('path, thumb')
  for (const r of (data as { path: string; thumb: string | null }[] | null) ?? []) {
    if (/^media\//.test(r.path)) set.add(r.path)
    if (r.thumb && /^media\//.test(r.thumb)) set.add(r.thumb)
  }
  for (const b of await listBlobs()) {
    if (b.pathname.startsWith('media/')) set.add(b.pathname)
  }
  return set
}

// First free "media/{base}.{ext}", adding -2, -3... only on collision. Reserves
// every name it returns plus the derived thumb/variant names in `taken`, so a
// later file in the same batch can't pick the same stem.
function freePathname(base: string, ext: string, taken: Set<string>): string {
  const make = (n: number) => `media/${n === 1 ? base : `${base}-${n}`}${ext ? `.${ext}` : ''}`
  let n = 1
  while (taken.has(make(n))) n++
  const path = make(n)
  taken.add(path)
  if (/\.(jpe?g|png)$/i.test(path)) {
    const stem = path.replace(/\.[^.]+$/, '')
    taken.add(`${stem}-thumb.webp`)
    for (const w of SIZES) { taken.add(`${stem}-${w}.webp`); taken.add(`${stem}-${w}.avif`) }
  }
  return path
}

// Process one file against an in-memory `taken` set: upload its blob(s) and
// return the row to insert (store-relative paths). Does NOT touch the DB — the
// caller inserts the whole batch at once.
async function processFile(
  filename: string,
  body: ArrayBuffer,
  contentType: string,
  taken: Set<string>,
): Promise<MediaRow> {
  const dot = filename.lastIndexOf('.')
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename) || 'file'
  const uploadedAt = new Date().toISOString()

  if (RASTER.test(contentType)) {
    const ext = contentType === 'image/png' ? 'png' : 'jpg'
    const origPath = freePathname(base, ext, taken)
    const stem = origPath.replace(/\.[^.]+$/, '')
    const original = Buffer.from(body)
    // Keep the ORIGINAL untouched + a cheap thumbnail only. Heavy display
    // variants are deferred to finalizeVariants() after save (variants: false).
    const { width, height } = await imageSize(original)
    await uploadFile(origPath, original, contentType)
    await uploadFile(`${stem}-thumb.webp`, await makeThumb(original), 'image/webp')
    return {
      path: origPath,
      filename: origPath.replace(/^media\//, ''),
      size: original.byteLength,
      uploaded_at: uploadedAt,
      width,
      height,
      thumb: `${stem}-thumb.webp`,
      variants: false,
    }
  }

  if (PASSTHROUGH.test(contentType)) {
    const ext = contentType === 'image/svg+xml' ? 'svg' : contentType === 'image/gif' ? 'gif' : 'webp'
    const path = freePathname(base, ext, taken)
    const buf = Buffer.from(body)
    await uploadFile(path, buf, contentType)
    const { width, height } = await safeSize(buf)
    return {
      path,
      filename: path.replace(/^media\//, ''),
      size: body.byteLength,
      uploaded_at: uploadedAt,
      width: width ?? null,
      height: height ?? null,
      thumb: path,
      variants: false,
    }
  }

  throw new Error(`Unsupported file type: ${contentType}`)
}

// Upload one or more files: push the binaries to Blob, then insert all rows in a
// single statement. Unsupported types throw before any DB write (route -> 415).
export async function addMediaBatch(
  files: { filename: string; body: ArrayBuffer; contentType: string }[],
): Promise<MediaItem[]> {
  const taken = await takenPathnames()
  const rows: MediaRow[] = []
  for (const f of files) {
    rows.push(await processFile(f.filename, f.body, f.contentType, taken))
  }
  const { error } = await db().from('media').insert(rows)
  if (error) throw new Error(`addMediaBatch: ${error.message}`)
  return rows.map(rowToItem)
}

// Upload a single file (kept for convenience; delegates to the batch path).
export async function addMedia(
  filename: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<MediaItem> {
  const [item] = await addMediaBatch([{ filename, body, contentType }])
  return item
}

// Register images the BROWSER already uploaded straight to Blob (client direct
// upload — bypasses the serverless 4.5MB request-body limit, so large photos no
// longer fail). The original is already on the store at `url`; we only fetch it
// back to read pixel dimensions and make the cheap thumbnail, then insert the row.
// Heavy display variants stay deferred (variants:false), generated by the caller's
// after()/cron exactly like the old upload path. Returns the inserted items.
export async function registerMediaBatch(items: { url: string; filename: string }[]): Promise<MediaItem[]> {
  const rows: MediaRow[] = []
  for (const it of items) {
    const path = collapseBlob(it.url)
    if (!/^media\//.test(path)) continue
    const res = await fetch(`${expandBlob(path)}?ts=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`registerMediaBatch: fetch ${path} → ${res.status}`)
    const contentType = res.headers.get('content-type') ?? ''
    const buf = Buffer.from(await res.arrayBuffer())
    const stem = path.replace(/\.[^.]+$/, '')
    const isRaster = RASTER.test(contentType) || /\.(jpe?g|png)$/i.test(path)
    let width: number | null = null
    let height: number | null = null
    let thumb = path // passthrough (svg/gif/webp): the original is its own thumb
    if (isRaster) {
      const sz = await imageSize(buf)
      width = sz.width || null
      height = sz.height || null
      thumb = `${stem}-thumb.webp`
      await uploadFile(thumb, await makeThumb(buf), 'image/webp')
    } else {
      const sz = await safeSize(buf)
      width = sz.width ?? null
      height = sz.height ?? null
    }
    rows.push({
      path,
      filename: it.filename || path.replace(/^media\//, ''),
      size: buf.byteLength,
      uploaded_at: new Date().toISOString(),
      width,
      height,
      thumb,
      variants: false,
    })
  }
  if (rows.length === 0) return []
  const { error } = await db().from('media').insert(rows)
  if (error) throw new Error(`registerMediaBatch: ${error.message}`)
  return rows.map(rowToItem)
}

// Extract the store-relative `media/...` pathname from any URL form — an absolute
// URL on ANY host (default store host or a vanity media domain) or an already-
// collapsed path. Host-independent, so a host mismatch can never make a delete
// silently no-op.
function mediaKey(s: string): string | null {
  return s.match(/media\/[^?#"')\s]+/)?.[0] ?? null
}

// Delete one or MORE media items. Each row delete is atomic in Postgres, so the
// old "concurrent manifest rewrite resurrected a deleted image" race is gone.
// Removes the DB rows first (the library's source of truth), THEN best-effort
// deletes the blob files. Returns the authoritative new list.
export async function deleteMediaBatch(urls: string[]): Promise<MediaItem[]> {
  const keys = [...new Set(urls.map(mediaKey).filter((k): k is string => k !== null))]
  if (keys.length === 0) return listMedia()

  // Fetch the rows we're about to remove (need thumb + variants for blob cleanup).
  const { data } = await db().from('media').select('*').in('path', keys)
  const removed = (data as MediaRow[] | null) ?? []
  if (removed.length === 0) return listMedia()

  // 1) Remove the rows first — this is what makes the images disappear.
  const { error } = await db().from('media').delete().in('path', keys)
  if (error) throw new Error(`deleteMediaBatch: ${error.message}`)

  // 2) Best-effort cleanup of EVERY blob file for each item: the ORIGINAL, the
  // thumbnail, and all four display variants. We attempt the variant paths for any
  // raster regardless of the `variants` flag (deletes are idempotent / no-op when a
  // file is absent), so nothing is ever left orphaned on the store — "delete an
  // image" removes every version of it, the original included.
  const paths = new Set<string>()
  for (const row of removed) {
    paths.add(row.path)
    if (row.thumb && row.thumb !== row.path) paths.add(row.thumb)
    if (/\.(jpe?g|png)$/i.test(row.path)) {
      const stem = row.path.replace(/\.[^.]+$/, '')
      paths.add(`${stem}-thumb.webp`)
      for (const w of SIZES) { paths.add(`${stem}-${w}.webp`); paths.add(`${stem}-${w}.avif`) }
    }
  }
  await Promise.all([...paths].map((p) => deleteByPathname(p).catch(() => {})))
  return listMedia()
}

// Delete a single media item (delegates to the batch path).
export async function deleteMedia(url: string): Promise<MediaItem[]> {
  return deleteMediaBatch([url])
}

// Owner-only diagnostic: report what a delete of `url` would match in the DB.
export async function debugDelete(url: string): Promise<{
  manifestCount: number
  targetKey: string | null
  matched: number
  sampleStored: string[]
}> {
  const targetKey = mediaKey(url)
  const { count } = await db().from('media').select('path', { count: 'exact', head: true })
  const { data: matchRows } = targetKey
    ? await db().from('media').select('path').eq('path', targetKey)
    : { data: [] }
  const { data: sample } = await db().from('media').select('path').limit(8)
  return {
    manifestCount: count ?? 0,
    targetKey,
    matched: (matchRows as unknown[] | null)?.length ?? 0,
    sampleStored: ((sample as { path: string }[] | null) ?? []).map((m) => m.path),
  }
}

// Generate the deferred display variants for the given raster originals that are
// still pending (variants: false). Called in the background after save, and swept
// by the keep-alive/finalize cron for anything left pending.
export async function finalizeVariants(pathnames: string[]): Promise<void> {
  const targets = [...new Set(pathnames)].filter((p) => /\.(jpe?g|png)$/i.test(p))
  if (targets.length === 0) return
  for (const path of targets) {
    const { data: row } = await db().from('media').select('variants').eq('path', path).maybeSingle()
    if (!row || (row as { variants: boolean }).variants) continue
    const res = await fetch(`${blobUrl(path)}?ts=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) continue
    const original = Buffer.from(await res.arrayBuffer())
    const stem = path.replace(/\.[^.]+$/, '')
    const files = await makeDisplay(original)
    await Promise.all(files.map((f) => uploadFile(`${stem}${f.suffix}`, f.data, f.contentType)))
    await db().from('media').update({ variants: true }).eq('path', path)
  }
}

// Backfill thumbnails for rows that have none (e.g. images imported by a script /
// the Postgres migration, which only recorded the original). Raster gets a real
// `-thumb.webp`; everything else just points `thumb` at the original (small enough
// for the grid). Swept by the cron so the library never has to load full originals.
export async function finalizePendingThumbs(): Promise<number> {
  const { data } = await db().from('media').select('path').is('thumb', null)
  const targets = ((data as { path: string }[] | null) ?? [])
  let done = 0
  for (const { path } of targets) {
    if (/\.(jpe?g|png)$/i.test(path)) {
      const res = await fetch(`${blobUrl(path)}?ts=${Date.now()}`, { cache: 'no-store' })
      if (!res.ok) continue
      const original = Buffer.from(await res.arrayBuffer())
      const stem = path.replace(/\.[^.]+$/, '')
      const thumbPath = `${stem}-thumb.webp`
      await uploadFile(thumbPath, await makeThumb(original), 'image/webp')
      await db().from('media').update({ thumb: thumbPath }).eq('path', path)
    } else {
      // Vector/animation/webp: the original is its own thumbnail.
      await db().from('media').update({ thumb: path }).eq('path', path)
    }
    done++
  }
  return done
}

// Finalize every uploaded raster referenced by a piece of content (body + image).
export async function finalizeContentMedia(content: string, featuredImage?: string): Promise<void> {
  const text = `${collapseBlob(content)} ${featuredImage ? collapseBlob(featuredImage) : ''}`
  const refs = [...text.matchAll(/media\/[^\s")'#]+\.(?:jpe?g|png)/gi)].map((m) => m[0])
  await finalizeVariants(refs)
}

// Sweep ALL raster originals still pending variants (variants: false) — the cron
// backstop so a variant set is never permanently missing if a background
// finalize didn't run (e.g. the function froze after the save response).
export async function finalizePendingVariants(): Promise<number> {
  const { data } = await db().from('media').select('path').eq('variants', false)
  const paths = ((data as { path: string }[] | null) ?? [])
    .map((r) => r.path)
    .filter((p) => /\.(jpe?g|png)$/i.test(p))
  if (paths.length === 0) return 0
  await finalizeVariants(paths)
  return paths.length
}
