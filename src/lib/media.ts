// Media data access. media/_index.json is the manifest; files live at
// media/{name}.{ext} with a clean, readable name (a "-2", "-3"... suffix is
// only added when a name collides). Raster images are optimized on upload.

import sharp from 'sharp'
import { unstable_cache } from 'next/cache'
import type { MediaItem } from '@/types'
import { readJson, writeJson, uploadFile, deleteByUrl, collapseBlob, expandBlob } from '@/lib/blob'
import { slugify } from '@/lib/utils'

const INDEX_PATH = 'media/_index.json'

// Resize cap + formats we re-encode. SVG/GIF (vector/animation) pass through.
const MAX_WIDTH = 1600
const OPTIMIZABLE = /^image\/(jpeg|png|webp|avif|tiff|bmp)$/

// Read the media manifest, newest upload first. Cached across requests under
// tag 'media'; upload/delete routes call revalidateTag('media') to refresh.
export const getMedia = unstable_cache(
  async (): Promise<MediaItem[]> => {
    const items = await readJson<MediaItem[]>(INDEX_PATH, [])
    return [...items]
      .map((m) => ({ ...m, url: expandBlob(m.url) })) // stored pathname -> absolute URL
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  },
  ['media-index'],
  { tags: ['media'] },
)

// Optimize a raster image: auto-orient, cap width, re-encode to WebP q80, strip
// metadata. Returns null for formats we leave untouched or on any failure.
async function optimize(
  body: ArrayBuffer,
  contentType: string,
): Promise<{ data: Buffer; contentType: string; ext: string } | null> {
  if (!OPTIMIZABLE.test(contentType)) return null
  try {
    const img = sharp(Buffer.from(body), { failOn: 'none' }).rotate()
    const meta = await img.metadata()
    if ((meta.width ?? 0) > MAX_WIDTH) img.resize({ width: MAX_WIDTH })
    const data = await img.webp({ quality: 80 }).toBuffer()
    return { data, contentType: 'image/webp', ext: 'webp' }
  } catch {
    return null
  }
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

// Upload one file: optimize if possible, give it a clean name, append to the
// manifest (read -> modify -> write).
export async function addMedia(
  filename: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<MediaItem> {
  const dot = filename.lastIndexOf('.')
  const origExt = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : ''
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename) || 'file'

  const opt = await optimize(body, contentType)
  const data = opt ? opt.data : Buffer.from(body)
  const type = opt ? opt.contentType : contentType
  const ext = opt ? opt.ext : origExt

  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  const pathname = freePathname(base, ext, existingPathnames(current))
  const url = await uploadFile(pathname, data, type)

  const item: MediaItem = {
    url, // absolute, for the client/editor
    filename: pathname.replace(/^media\//, ''),
    size: data.byteLength,
    uploadedAt: new Date().toISOString(),
  }
  // Store the pathname; getMedia re-expands on read.
  await writeJson(INDEX_PATH, [{ ...item, url: collapseBlob(url) }, ...current])
  return item
}

// Delete a media item by its blob URL and drop it from the manifest.
export async function deleteMedia(url: string): Promise<void> {
  await deleteByUrl(url)
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  // Index entries are store-relative; compare on pathname so either form matches.
  const target = collapseBlob(url)
  await writeJson(
    INDEX_PATH,
    current.filter((m) => collapseBlob(m.url) !== target),
  )
}
