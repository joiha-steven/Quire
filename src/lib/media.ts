// Media data access. media/_index.json is the manifest.
// Raster photos (jpg/png) keep the untouched ORIGINAL plus generated responsive
// variants: -1024 / -1600 in both AVIF and WebP, and a -thumb.webp for the
// library. Vector/animation/webp (svg/gif/webp — logos, icons) are stored as-is.
// Variant URLs are derived by convention from the original's name.

import sharp from 'sharp'
import { unstable_cache } from 'next/cache'
import type { MediaItem } from '@/types'
import {
  readJson, writeJson, uploadFile, blobUrl, deleteByPathname, collapseBlob, expandBlob,
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

// Existing pathnames (e.g. "media/logo.webp") from the manifest, for dedupe.
function existingPathnames(items: MediaItem[]): Set<string> {
  const set = new Set<string>()
  for (const m of items) {
    if (/^media\//.test(m.url)) { set.add(m.url); continue } // already a pathname
    try {
      set.add(new URL(m.url).pathname.replace(/^\//, ''))
    } catch {
      /* skip malformed url */
    }
  }
  return set
}

// First free "media/{base}.{ext}", adding -2, -3... only on collision.
function freePathname(base: string, ext: string, taken: Set<string>): string {
  const make = (n: number) => `media/${n === 1 ? base : `${base}-${n}`}${ext ? `.${ext}` : ''}`
  let n = 1
  while (taken.has(make(n))) n++
  return make(n)
}

// Upload one file. Raster -> original + variants; vector/anim -> as-is.
// Index entries store pathnames (getMedia re-expands); returns absolute URLs.
export async function addMedia(
  filename: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<MediaItem> {
  const dot = filename.lastIndexOf('.')
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename) || 'file'
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  const taken = existingPathnames(current)
  const uploadedAt = new Date().toISOString()

  if (RASTER.test(contentType)) {
    const ext = contentType === 'image/png' ? 'png' : 'jpg'
    const origPath = freePathname(base, ext, taken)
    const stem = origPath.replace(/\.[^.]+$/, '')
    const original = Buffer.from(body)
    // On upload: keep the ORIGINAL untouched + a cheap thumbnail only. The heavy
    // display variants are generated later by finalizeVariants() on save, so an
    // image dropped then discarded never pays the AVIF encode (variants: false).
    const { width, height } = await imageSize(original)
    await uploadFile(origPath, original, contentType)
    await uploadFile(`${stem}-thumb.webp`, await makeThumb(original), 'image/webp')
    const item: MediaItem = {
      url: blobUrl(origPath),
      filename: origPath.replace(/^media\//, ''),
      size: original.byteLength,
      uploadedAt,
      width,
      height,
      thumb: blobUrl(`${stem}-thumb.webp`),
      variants: false,
    }
    await writeJson(INDEX_PATH, [
      { ...item, url: origPath, thumb: `${stem}-thumb.webp` },
      ...current,
    ])
    return item
  }

  if (PASSTHROUGH.test(contentType)) {
    const ext = contentType === 'image/svg+xml' ? 'svg' : contentType === 'image/gif' ? 'gif' : 'webp'
    const path = freePathname(base, ext, taken)
    const url = await uploadFile(path, Buffer.from(body), contentType)
    const item: MediaItem = {
      url,
      filename: path.replace(/^media\//, ''),
      size: body.byteLength,
      uploadedAt,
      thumb: url, // its own thumbnail
      variants: false,
    }
    await writeJson(INDEX_PATH, [{ ...item, url: path, thumb: path }, ...current])
    return item
  }

  throw new Error(`Unsupported file type: ${contentType}`)
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
