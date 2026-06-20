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
async function makeVariants(
  original: Buffer,
): Promise<{ width: number; height: number; files: Variant[] }> {
  const meta = await sharp(original, { failOn: 'none' }).rotate().metadata()
  const ow = meta.width ?? 0
  const oh = meta.height ?? 0
  const files: Variant[] = []
  for (const w of SIZES) {
    const pipe = sharp(original, { failOn: 'none' })
      .rotate()
      .resize({ width: ow ? Math.min(w, ow) : w, withoutEnlargement: true })
    files.push({ suffix: `-${w}.webp`, data: await pipe.clone().webp({ quality: 80 }).toBuffer(), contentType: 'image/webp' })
    files.push({ suffix: `-${w}.avif`, data: await pipe.clone().avif({ quality: 50 }).toBuffer(), contentType: 'image/avif' })
  }
  const thumb = await sharp(original, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()
  files.push({ suffix: '-thumb.webp', data: thumb, contentType: 'image/webp' })
  return { width: ow, height: oh, files }
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
    // Keep the original untouched (uncompressed) + every generated variant.
    await uploadFile(origPath, original, contentType)
    const { width, height, files } = await makeVariants(original)
    await Promise.all(files.map((f) => uploadFile(`${stem}${f.suffix}`, f.data, f.contentType)))
    const item: MediaItem = {
      url: blobUrl(origPath),
      filename: origPath.replace(/^media\//, ''),
      size: original.byteLength,
      uploadedAt,
      width,
      height,
      thumb: blobUrl(`${stem}-thumb.webp`),
      variants: true,
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

// Delete a media item: the original + every derived variant + its manifest entry.
export async function deleteMedia(url: string): Promise<void> {
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  const target = collapseBlob(url) // original pathname
  const item = current.find((m) => collapseBlob(m.url) === target)
  const paths = [target]
  if (item?.variants) {
    const stem = target.replace(/\.[^.]+$/, '')
    for (const w of SIZES) paths.push(`${stem}-${w}.webp`, `${stem}-${w}.avif`)
    paths.push(`${stem}-thumb.webp`)
  }
  await Promise.all(paths.map((p) => deleteByPathname(p).catch(() => {})))
  await writeJson(INDEX_PATH, current.filter((m) => collapseBlob(m.url) !== target))
}
