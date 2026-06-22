// Media: metadata in Postgres `media`, binaries on Blob. Raster (jpg/png) keeps
// the untouched ORIGINAL + responsive variants (-1024/-1600 AVIF+WebP) + a
// -thumb.webp. Vector/anim (svg/gif/webp) stored as-is. Variant URLs derived by
// convention from the original's name.

import { cache } from 'react'
import type { MediaItem } from '@/types'
import {
  uploadFile, blobUrl, deleteByPathname, collapseBlob, expandBlob, listBlobs,
} from '@/lib/blob'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'
import {
  imageSize, safeSize, makeThumb, makeDisplay, RASTER, PASSTHROUGH, SIZES,
} from '@/lib/image'

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
  deleted_at?: string | null
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
    deletedAt: row.deleted_at ?? undefined,
  }
}

// Non-cached read of the whole library, newest first (mutating helpers use it to
// return authoritative current state).
async function listMedia(): Promise<MediaItem[]> {
  try {
    const { data, error } = await db()
      .from('media')
      .select('*')
      .is('deleted_at', null) // live library only; trashed images live in the Trash view
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

// Library list, newest first. `React.cache` dedupes within one render; each
// request re-reads Postgres so the library is always fresh.
export const getMedia = cache(listMedia)

// All taken media pathnames, for collision-free naming. Unions DB rows with
// ACTUAL store contents (listBlobs) so derived thumb/variant names are covered too.
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

// First free "media/{base}.{ext}", appending -2, -3... on collision. Reserves the
// returned name + its derived thumb/variant names so a later batch file can't reuse the stem.
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

// Process one file: upload its blob(s) and return the row to insert. Does NOT
// touch the DB — the caller inserts the whole batch at once.
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
    // ORIGINAL untouched + cheap thumb only; heavy variants deferred to finalizeVariants().
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

// Register images the BROWSER uploaded straight to Blob (direct upload bypasses the
// serverless 4.5MB body limit). Original is already on the store; we fetch it back
// only to read dims + make the thumb, then insert the row. Variants stay deferred.
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

// Extract the store-relative `media/...` pathname from any URL form (host-independent,
// so a host mismatch can never make a delete silently no-op).
function mediaKey(s: string): string | null {
  return s.match(/media\/[^?#"')\s]+/)?.[0] ?? null
}

// Soft-delete media (set deleted_at) — KEEPS every blob, so a published post
// linking these images keeps rendering until an explicit Trash purge.
export async function deleteMediaBatch(urls: string[]): Promise<MediaItem[]> {
  const keys = [...new Set(urls.map(mediaKey).filter((k): k is string => k !== null))]
  if (keys.length === 0) return listMedia()
  const { error } = await db()
    .from('media')
    .update({ deleted_at: new Date().toISOString() })
    .in('path', keys)
  if (error) throw new Error(`deleteMediaBatch: ${error.message}`)
  return listMedia()
}

// Soft-delete a single media item (delegates to the batch path).
export async function deleteMedia(url: string): Promise<MediaItem[]> {
  return deleteMediaBatch([url])
}

// Restore trashed media back to the live library (clear deleted_at). Returns the
// authoritative live list.
export async function restoreMediaBatch(urls: string[]): Promise<MediaItem[]> {
  const keys = [...new Set(urls.map(mediaKey).filter((k): k is string => k !== null))]
  if (keys.length === 0) return listMedia()
  const { error } = await db().from('media').update({ deleted_at: null }).in('path', keys)
  if (error) throw new Error(`restoreMediaBatch: ${error.message}`)
  return listMedia()
}

// Hard delete (irreversible, Trash UI only): remove DB rows first (source of
// truth), then best-effort delete blobs.
export async function purgeMediaBatch(urls: string[]): Promise<void> {
  const keys = [...new Set(urls.map(mediaKey).filter((k): k is string => k !== null))]
  if (keys.length === 0) return

  // Need thumb + variants for blob cleanup.
  const { data } = await db().from('media').select('*').in('path', keys)
  const removed = (data as MediaRow[] | null) ?? []
  if (removed.length === 0) return

  const { error } = await db().from('media').delete().in('path', keys)
  if (error) throw new Error(`purgeMediaBatch: ${error.message}`)

  // Clean up EVERY blob (original + thumb + all variants). Variant paths attempted
  // for any raster regardless of the flag — deletes are idempotent, so nothing orphans.
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
}

// Trashed media (most-recently-deleted first) for the Trash view.
export async function getTrashedMedia(): Promise<MediaItem[]> {
  try {
    const { data, error } = await db()
      .from('media')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] media.getTrashedMedia: ${error.message}`)
      return []
    }
    return (data as MediaRow[]).map(rowToItem)
  } catch (error) {
    console.error(`[ERROR] media.getTrashedMedia: ${(error as Error).message}`)
    return []
  }
}

// Permanently remove EVERY trashed media item (empty the media Trash). Returns the count.
export async function emptyMediaTrash(): Promise<number> {
  const trashed = await getTrashedMedia()
  if (trashed.length === 0) return 0
  await purgeMediaBatch(trashed.map((m) => m.url))
  return trashed.length
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

// Generate deferred display variants for pending raster originals (variants:false).
// Called via after() post-save; cron sweeps anything left pending.
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

// Backfill thumbs for rows that have none (script/migration imports). Raster gets a
// real `-thumb.webp`; everything else points `thumb` at the original. Cron-swept.
export async function finalizePendingThumbs(): Promise<number> {
  const { data } = await db().from('media').select('path').is('thumb', null).is('deleted_at', null)
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

// Cron backstop: sweep all raster originals still pending variants, in case a
// background finalize never ran (e.g. the function froze after the save response).
export async function finalizePendingVariants(): Promise<number> {
  const { data } = await db().from('media').select('path').eq('variants', false).is('deleted_at', null)
  const paths = ((data as { path: string }[] | null) ?? [])
    .map((r) => r.path)
    .filter((p) => /\.(jpe?g|png)$/i.test(p))
  if (paths.length === 0) return 0
  await finalizeVariants(paths)
  return paths.length
}
