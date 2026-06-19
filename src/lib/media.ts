// Media data access. media/_index.json is the manifest; files live at
// media/{timestamp}-{name} with their original filename preserved.

import type { MediaItem } from '@/types'
import { readJson, writeJson, uploadFile, deleteByUrl } from '@/lib/blob'
import { slugify } from '@/lib/utils'

const INDEX_PATH = 'media/_index.json'

// Read the media manifest, newest upload first.
export async function getMedia(): Promise<MediaItem[]> {
  const items = await readJson<MediaItem[]>(INDEX_PATH, [])
  return [...items].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime(),
  )
}

// Build a collision-resistant, URL-safe pathname that keeps the readable name.
function buildPathname(filename: string): string {
  const dot = filename.lastIndexOf('.')
  const ext = dot >= 0 ? filename.slice(dot + 1).toLowerCase() : ''
  const base = slugify(dot >= 0 ? filename.slice(0, dot) : filename) || 'file'
  const stamp = Date.now()
  return ext ? `media/${stamp}-${base}.${ext}` : `media/${stamp}-${base}`
}

// Upload one file and append it to the manifest (read -> modify -> write).
export async function addMedia(
  filename: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<MediaItem> {
  const pathname = buildPathname(filename)
  const url = await uploadFile(pathname, body, contentType)
  const item: MediaItem = {
    url,
    filename,
    size: body.byteLength,
    uploadedAt: new Date().toISOString(),
  }
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  await writeJson(INDEX_PATH, [item, ...current])
  return item
}

// Delete a media item by its blob URL and drop it from the manifest.
export async function deleteMedia(url: string): Promise<void> {
  await deleteByUrl(url)
  const current = await readJson<MediaItem[]>(INDEX_PATH, [])
  await writeJson(
    INDEX_PATH,
    current.filter((m) => m.url !== url),
  )
}
