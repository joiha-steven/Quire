// Media data access. media/_index.json is the manifest.
// Raster photos (jpg/png) keep the untouched ORIGINAL plus generated responsive
// variants: -1024 / -1600 in both AVIF and WebP, and a -thumb.webp for the
// library. Vector/animation/webp (svg/gif/webp — logos, icons) are stored as-is.
// Variant URLs are derived by convention from the original's name.

import sharp from 'sharp'
import { unstable_cache } from 'next/cache'
import type { MediaItem } from '@/types'
import {
  readJson, writeJson, uploadFile, blobUrl, deleteByPathname, collapseBlob, expandBlob, listBlobs,
} from '@/lib/blob'
import { slugify } from '@/lib/utils'

const INDEX_PATH = 'media/_index.json'

const RASTER = /^image\/(jpeg|png)$/ // full responsive pipeline
const PASSTHROUGH = /^image\/(svg\+xml|gif|webp)$/ // stored as-is, no variants
const SIZES = [1024, 1600] as const // display widths (in-column / wider)
const THUMB_WIDTH = 400

// Read the media manifest, newest upload first. Cached across requests under
// tag 'media'; upload/delete routes call revalidateTag('media') to refresh.
export const getMedia = unstable_cache(
  async (): Promise<MediaItem[]> => {
    const items = await readJson<MediaItem[]>(INDEX_PATH, [])
    return [...items]
      .map((m) => ({
        ...m,
        url: expandBlob(m.url), // stored pathname -> absolute URL
        thumb: m.thumb ? expandBlob(m.thumb) : undefined,
      }))
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  },
  ['media-index-v2'],
  { tags: ['media'] },
)

type Variant = { suffix: string; data: Buffer; contentType: string }

// From the original bytes, build the responsive set (auto-oriented). Widths are
// capped at the original (never upscaled) so files always exist for the renderer.
async function imageSize(original: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(original, { failOn: 'none' }).rotate().metadata()
  return { width: meta.width ?? 0, height: meta.height ?? 0 }
}

// Small library thumbnail — cheap, made on upload so the grid renders at once.
async function makeThumb(original: Buffer): Promise<Buffer> {
  return sharp(original, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()
}

// The heavy display set (AVIF + WebP @ each size) — deferred to save-time so
// images discarded before saving never pay the AVIF encode.
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

// All media pathnames already taken, for collision-free naming. Unions the
// manifest with the ACTUAL store contents (listBlobs) so a stale manifest read
// can never hand back a name that already exists in the store — that was the
// cause of intermittent "blob already exists" upload errors. Also covers the
// derived thumb/variant names (which are not separate manifest entries).
async function takenPathnames(items: MediaItem[]): Promise<Set<string>> {
  const set = new Set<string>()
  for (const m of items) {
    const p = collapseBlob(m.url)
    if (/^media\//.test(p)) set.add(p)
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
// return both the client item (absolute URLs) and the stored entry (pathnames).
// Does NOT touch the manifest — the caller writes it once for the whole batch.
async function processFile(
  filename: string,
  body: ArrayBuffer,
  contentType: string,
  taken: Set<string>,
): Promise<{ item: MediaItem; stored: MediaItem }> {
  const dot = filename.lastIndexOf('.')
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename) || 'file'
  const uploadedAt = new Date().toISOString()

  if (RASTER.test(contentType)) {
    const ext = contentType === 'image/png' ? 'png' : 'jpg'
    const origPath = freePathname(base, ext, taken)
    const stem = origPath.replace(/\.[^.]+$/, '')
    const original = Buffer.from(body)
    // Keep the ORIGINAL untouched + a cheap thumbnail only. Heavy display
    // variants are deferred to finalizeVariants() on save (variants: false).
    const { width, height } = await imageSize(original)
    await uploadFile(origPath, original, contentType)
    await uploadFile(`${stem}-thumb.webp`, await makeThumb(original), 'image/webp')
    const common = {
      filename: origPath.replace(/^media\//, ''),
      size: original.byteLength,
      uploadedAt,
      width,
      height,
      variants: false as const,
    }
    return {
      item: { ...common, url: blobUrl(origPath), thumb: blobUrl(`${stem}-thumb.webp`) },
      stored: { ...common, url: origPath, thumb: `${stem}-thumb.webp` },
    }
  }

  if (PASSTHROUGH.test(contentType)) {
    const ext = contentType === 'image/svg+xml' ? 'svg' : contentType === 'image/gif' ? 'gif' : 'webp'
    const path = freePathname(base, ext, taken)
    const url = await uploadFile(path, Buffer.from(body), contentType)
    const common = {
      filename: path.replace(/^media\//, ''),
      size: body.byteLength,
      uploadedAt,
      variants: false as const,
    }
    return {
      item: { ...common, url, thumb: url },
      stored: { ...common, url: path, thumb: path },
    }
  }

  throw new Error(`Unsupported file type: ${contentType}`)
}

// Upload one or more files in a SINGLE read-modify-write of the manifest. Doing
// the whole batch under one read + one write removes the lost-update race that
// dropped entries when several images were uploaded at once ("lúc ăn lúc không").
// Unsupported types throw before any manifest write (route maps to 415).
export async function addMediaBatch(
  files: { filename: string; body: ArrayBuffer; contentType: string }[],
): Promise<MediaItem[]> {
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  const taken = await takenPathnames(current)
  const items: MediaItem[] = []
  const stored: MediaItem[] = []
  for (const f of files) {
    const r = await processFile(f.filename, f.body, f.contentType, taken)
    items.push(r.item)
    stored.push(r.stored)
  }
  await writeJson(INDEX_PATH, [...stored, ...current])
  return items
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

// Delete a media item: the original + thumbnail + every display variant + entry.
export async function deleteMedia(url: string): Promise<void> {
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  const target = collapseBlob(url) // original pathname
  const item = current.find((m) => collapseBlob(m.url) === target)
  const paths = new Set<string>([target])
  if (item?.thumb) paths.add(collapseBlob(item.thumb))
  if (item?.variants) {
    const stem = target.replace(/\.[^.]+$/, '')
    for (const w of SIZES) { paths.add(`${stem}-${w}.webp`); paths.add(`${stem}-${w}.avif`) }
  }
  await Promise.all([...paths].map((p) => deleteByPathname(p).catch(() => {})))
  await writeJson(INDEX_PATH, current.filter((m) => collapseBlob(m.url) !== target))
}

// Generate the deferred display variants for the given raster originals that are
// still pending (variants: false). Called on save for images kept in the content.
export async function finalizeVariants(pathnames: string[]): Promise<void> {
  const targets = [...new Set(pathnames)].filter((p) => /\.(jpe?g|png)$/i.test(p))
  if (targets.length === 0) return
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  let changed = false
  for (const path of targets) {
    const item = current.find((m) => collapseBlob(m.url) === path)
    if (!item || item.variants) continue
    const res = await fetch(`${blobUrl(path)}?ts=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) continue
    const original = Buffer.from(await res.arrayBuffer())
    const stem = path.replace(/\.[^.]+$/, '')
    const files = await makeDisplay(original)
    await Promise.all(files.map((f) => uploadFile(`${stem}${f.suffix}`, f.data, f.contentType)))
    item.variants = true
    changed = true
  }
  if (changed) await writeJson(INDEX_PATH, current)
}

// Finalize every uploaded raster referenced by a piece of content (body + image).
export async function finalizeContentMedia(content: string, featuredImage?: string): Promise<void> {
  const text = `${collapseBlob(content)} ${featuredImage ? collapseBlob(featuredImage) : ''}`
  const refs = [...text.matchAll(/media\/[^\s")'#]+\.(?:jpe?g|png)/gi)].map((m) => m[0])
  await finalizeVariants(refs)
}
