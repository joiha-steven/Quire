// Small file store for site icons (favicon, app icon) kept OUT of the media
// library so they don't clutter the post-image grid. Uploaded under `files/` on
// Blob. Unlike media, `.ico` is accepted here (favicons are often .ico), and no
// variants/thumbnails are generated — the icon is stored verbatim.

import { cache } from 'react'
import type { FileItem } from '@/types'
import {
  uploadFile, readJson, writeJson, blobUrl, expandBlob, collapseBlob, deleteByPathname, listBlobs,
} from '@/lib/blob'
import { slugify } from '@/lib/utils'
import { getSettings } from '@/lib/settings'

// contentType -> file extension. `.ico` arrives as x-icon / vnd.microsoft.icon
// (and occasionally a bare type), so it's matched explicitly.
const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
  'image/vnd.microsoft.icon': 'ico',
}

export function isAllowedIconType(contentType: string): boolean {
  return contentType in EXT
}

// Upload one icon and return its absolute URL. `kind` namespaces the stored name
// (favicon / app-icon); a timestamp keeps it unique so a replaced icon gets a
// fresh URL (busting the aggressive favicon cache) instead of overwriting.
export async function uploadIcon(kind: string, body: ArrayBuffer | Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType]
  if (!ext) throw new Error(`Unsupported icon type: ${contentType}`)
  const path = `files/${kind}-${Date.now()}.${ext}`
  return uploadFile(path, body, contentType)
}

// ----- General file library ("Files" tab) -------------------------------------
// Any non-image attachment (PDF, zip, docx, audio…). Listed via a manifest so the
// site icons under files/ (favicon-*, app-icon-*), which are NOT in the manifest,
// never show up here. Stored verbatim — no thumbnails or variants.

const FILES_INDEX = 'files/_index.json'
const ICON_PREFIXES = ['favicon-', 'app-icon-'] // managed in Settings, hidden here

// Read the file manifest, newest first. Fresh every request (React.cache dedupes
// per render) so a deleted file is gone the moment the library reopens.
// Expand stored entries into client items (absolute URLs, newest first) — the
// exact shape getFiles returns, so callers can hand back the in-memory post-write
// list without re-reading Blob.
function toClientFiles(items: FileItem[]): FileItem[] {
  return [...items]
    .map((f) => ({ ...f, url: expandBlob(f.url) }))
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
}

export const getFiles = cache(async (): Promise<FileItem[]> => {
  await getSettings() // prime the vanity media base before expandBlob
  const items = await readJson<FileItem[]>(FILES_INDEX, [])
  return toClientFiles(items)
})

// All `files/` pathnames already taken (manifest ∪ actual store contents, incl.
// the icon files), so a new upload never collides with an existing name.
async function takenFilePaths(items: FileItem[]): Promise<Set<string>> {
  const set = new Set<string>()
  for (const f of items) set.add(collapseBlob(f.url))
  for (const b of await listBlobs()) {
    if (b.pathname.startsWith('files/')) set.add(b.pathname)
  }
  return set
}

// First free `files/{base}.{ext}`, adding -2, -3… only on collision.
function freeFilePath(base: string, ext: string, taken: Set<string>): string {
  const make = (n: number) => `files/${n === 1 ? base : `${base}-${n}`}${ext ? `.${ext}` : ''}`
  let n = 1
  while (taken.has(make(n))) n++
  const path = make(n)
  taken.add(path)
  return path
}

// Upload one or more files in a SINGLE read-modify-write of the manifest (same
// lost-update-safe batch pattern as media). Returns the client items (absolute
// URLs). Any content type is accepted — this is the catch-all attachment store.
export async function addFilesBatch(
  files: { filename: string; body: ArrayBuffer; contentType: string }[],
): Promise<FileItem[]> {
  const current = await readJson<FileItem[]>(FILES_INDEX, [])
  const taken = await takenFilePaths(current)
  const items: FileItem[] = []
  const stored: FileItem[] = []
  for (const f of files) {
    const dot = f.filename.lastIndexOf('.')
    const rawExt = dot >= 0 ? f.filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
    const base = slugify(dot >= 0 ? f.filename.slice(0, dot) : f.filename) || 'file'
    const path = freeFilePath(base, rawExt, taken)
    await uploadFile(path, f.body, f.contentType || 'application/octet-stream')
    const common = {
      filename: f.filename,
      size: f.body.byteLength,
      contentType: f.contentType || 'application/octet-stream',
      uploadedAt: new Date().toISOString(),
    }
    items.push({ ...common, url: blobUrl(path) })
    stored.push({ ...common, url: path })
  }
  await writeJson(FILES_INDEX, [...stored, ...current])
  return items
}

// Extract the store-relative `files/...` pathname from any URL form (absolute on
// any host, or already collapsed) — host-independent matching, same rationale as
// media's mediaKey.
function fileKey(s: string): string | null {
  return s.match(/files\/[^?#"')\s]+/)?.[0] ?? null
}

// Delete a file: its manifest entry + blob. Refuses to touch the site icons,
// which are not manifest entries (defence in depth — they never reach here).
// Manifest write first, then blob cleanup. Returns the AUTHORITATIVE new list
// from the in-memory manifest (no Blob re-read).
export async function deleteFile(url: string): Promise<FileItem[]> {
  const current = await readJson<FileItem[]>(FILES_INDEX, [])
  const targetKey = fileKey(url)
  if (!targetKey || ICON_PREFIXES.some((p) => targetKey.startsWith(`files/${p}`))) {
    return toClientFiles(current)
  }
  const remaining = current.filter((f) => fileKey(f.url) !== targetKey)
  if (remaining.length === current.length) return toClientFiles(current) // no match: don't rewrite
  await writeJson(FILES_INDEX, remaining)
  await deleteByPathname(targetKey).catch(() => {})
  return toClientFiles(remaining)
}
