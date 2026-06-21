// Small file store for site icons (favicon, app icon) kept OUT of the media
// library so they don't clutter the post-image grid, plus a general "Files"
// attachment library. Binaries are uploaded under `files/` on Blob; the Files
// library metadata lives in the Postgres `files` table. Site icons are stored
// verbatim on Blob and are NOT table rows, so they never show in the Files tab.

import { cache } from 'react'
import sharp from 'sharp'
import type { FileItem } from '@/types'
import {
  uploadFile, expandBlob, collapseBlob, deleteByPathname, listBlobs,
} from '@/lib/blob'
import { db } from '@/lib/db'
import { slugify } from '@/lib/utils'

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

// ----- Logo render (auto-sized for the header) --------------------------------
// The owner picks a full-size logo from the media library (kept untouched). For
// the header we don't want to ship that original — instead we generate ONE small
// WebP scaled to the chosen header width, at 2x so it stays crisp on retina /
// hi-dpi screens, and never upscaled past the source. The derived file lives
// under files/logo-*.webp (NOT a Files-table row, NOT an icon → hidden from every
// grid). saveSettings deletes the previous derived file each time it regenerates,
// so exactly one ever exists. Vector (svg) / animated (gif) / undecodable sources
// return null → the caller serves the original as-is (vectors scale for free).

const LOGO_RASTER = /^image\/(png|jpe?g|webp)$/
const LOGO_EXT_RASTER = /\.(png|jpe?g|jpg|webp)(?:$|[?#])/i

// Build the header logo for `width` CSS px. Returns the derived WebP url + its
// displayed height (px) at that width (so the <img> can reserve space → no CLS),
// or null when the source isn't a downscalable raster.
export async function renderLogo(
  sourceUrl: string,
  width: number,
): Promise<{ url: string; height: number } | null> {
  if (!sourceUrl) return null
  let res: Response
  try {
    res = await fetch(sourceUrl)
  } catch {
    return null
  }
  if (!res.ok) return null
  const contentType = res.headers.get('content-type') ?? ''
  const isRaster = LOGO_RASTER.test(contentType) || (!contentType && LOGO_EXT_RASTER.test(sourceUrl))
  if (!isRaster) return null // svg / gif / unknown: serve original untouched
  const src = Buffer.from(await res.arrayBuffer())
  try {
    // 2x the display width for retina; withoutEnlargement keeps small logos sharp
    // (never upscaled past the original's pixels).
    const out = await sharp(src, { failOn: 'none' })
      .rotate()
      .resize({ width: Math.round(width * 2), withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
    const meta = await sharp(out).metadata()
    const path = `files/logo-${Date.now()}.webp`
    const url = await uploadFile(path, out, 'image/webp')
    // Displayed height = CSS width × the rendered aspect ratio.
    const height = meta.width ? Math.round(width * (meta.height ?? 0) / meta.width) : 0
    return { url, height }
  } catch {
    return null // decode/encode failure: caller falls back to the original
  }
}

// ----- Custom font upload ------------------------------------------------------
// Owner-uploaded typeface, stored under files/ on Blob (like the site icons —
// kept OUT of the Files table so it never shows in the attachment grid). Returns
// the absolute URL + a CSS family name derived from the original filename.

const FONT_EXT = new Set(['woff2', 'woff', 'ttf', 'otf'])

export function fontExt(filename: string): string {
  return filename.split(/[?#]/)[0].split('.').pop()?.toLowerCase() ?? ''
}
export function isAllowedFontType(filename: string): boolean {
  return FONT_EXT.has(fontExt(filename))
}

// Strip common weight/style tokens so the derived family is shared across the
// weight slots (e.g. "Inter-Bold" / "Inter Regular" → "Inter").
const WEIGHT_TOKENS = /\b(thin|extralight|ultralight|light|regular|normal|book|text|medium|semibold|demibold|bold|extrabold|ultrabold|black|heavy|italic|oblique|variable|vf)\b/gi

export async function uploadFont(
  filename: string,
  weight: number,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<{ url: string; family: string; weight: number }> {
  const ext = fontExt(filename)
  if (!FONT_EXT.has(ext)) throw new Error(`Unsupported font type: ${ext}`)
  // CSS family from the base name (weight/style words + separators removed).
  const base = filename.slice(0, filename.length - ext.length - 1)
  const family =
    base.replace(WEIGHT_TOKENS, ' ').replace(/[^A-Za-z0-9 _-]/g, ' ').replace(/[\s_-]+/g, ' ').trim().slice(0, 64) ||
    'Custom Font'
  const path = `files/font-${weight}-${Date.now()}.${ext}`
  const url = await uploadFile(path, body, contentType || 'font/' + (ext === 'ttf' ? 'ttf' : ext))
  return { url, family, weight }
}

// ----- General file library ("Files" tab) -------------------------------------
// Any non-image attachment (PDF, zip, docx, audio…). Listed from the `files`
// table so the site icons under files/ (favicon-*, app-icon-*), which are NOT
// rows, never show up here. Stored verbatim — no thumbnails or variants.

const ICON_PREFIXES = ['favicon-', 'app-icon-'] // managed in Settings, hidden here

type FileRow = {
  url: string
  filename: string
  size: number
  content_type: string
  uploaded_at: string
}

function rowToItem(row: FileRow): FileItem {
  return {
    url: expandBlob(row.url),
    filename: row.filename,
    size: Number(row.size),
    contentType: row.content_type,
    uploadedAt: row.uploaded_at,
  }
}

// Non-cached read of the library, newest first. Used by the mutating helpers so
// they return the authoritative current state.
async function listFiles(): Promise<FileItem[]> {
  try {
    const { data, error } = await db()
      .from('files')
      .select('*')
      .order('uploaded_at', { ascending: false })
    if (error || !data) {
      if (error) console.error(`[ERROR] files.listFiles: ${error.message}`)
      return []
    }
    return (data as FileRow[]).map(rowToItem)
  } catch (error) {
    console.error(`[ERROR] files.listFiles: ${(error as Error).message}`)
    return []
  }
}

// Library list, newest first. Fresh every request (React.cache dedupes per render).
export const getFiles = cache(listFiles)

// All `files/` pathnames already taken (table rows ∪ actual store contents, incl.
// the icon files), so a new upload never collides with an existing name.
async function takenFilePaths(): Promise<Set<string>> {
  const set = new Set<string>()
  const { data } = await db().from('files').select('url')
  for (const r of (data as { url: string }[] | null) ?? []) set.add(collapseBlob(r.url))
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

// Upload one or more files: push binaries to Blob, then insert all rows at once.
// Any content type is accepted — this is the catch-all attachment store.
export async function addFilesBatch(
  files: { filename: string; body: ArrayBuffer; contentType: string }[],
): Promise<FileItem[]> {
  const taken = await takenFilePaths()
  const rows: FileRow[] = []
  for (const f of files) {
    const dot = f.filename.lastIndexOf('.')
    const rawExt = dot >= 0 ? f.filename.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
    const base = slugify(dot >= 0 ? f.filename.slice(0, dot) : f.filename) || 'file'
    const path = freeFilePath(base, rawExt, taken)
    await uploadFile(path, f.body, f.contentType || 'application/octet-stream')
    rows.push({
      url: path,
      filename: f.filename,
      size: f.body.byteLength,
      content_type: f.contentType || 'application/octet-stream',
      uploaded_at: new Date().toISOString(),
    })
  }
  const { error } = await db().from('files').insert(rows)
  if (error) throw new Error(`addFilesBatch: ${error.message}`)
  return rows.map(rowToItem)
}

// Register files the BROWSER already uploaded straight to Blob (client direct
// upload — bypasses the serverless 4.5MB request-body limit, so large files no
// longer fail). The binary is already on the store at `url`; we just insert the
// metadata row. Returns the inserted items.
export async function registerFilesBatch(
  items: { url: string; filename: string; size: number; contentType: string }[],
): Promise<FileItem[]> {
  const rows: FileRow[] = items
    .map((i) => ({
      url: collapseBlob(i.url),
      filename: i.filename,
      size: i.size,
      content_type: i.contentType || 'application/octet-stream',
      uploaded_at: new Date().toISOString(),
    }))
    .filter((r) => /^files\//.test(r.url) && !ICON_PREFIXES.some((p) => r.url.startsWith(`files/${p}`)))
  if (rows.length === 0) return []
  const { error } = await db().from('files').insert(rows)
  if (error) throw new Error(`registerFilesBatch: ${error.message}`)
  return rows.map(rowToItem)
}

// Extract the store-relative `files/...` pathname from any URL form (absolute on
// any host, or already collapsed) — host-independent matching.
function fileKey(s: string): string | null {
  return s.match(/files\/[^?#"')\s]+/)?.[0] ?? null
}

// Delete a file: its row + blob. Refuses to touch the site icons (not rows;
// defence in depth — they never reach here). Row delete first, then blob cleanup.
// Returns the authoritative new list.
export async function deleteFile(url: string): Promise<FileItem[]> {
  const targetKey = fileKey(url)
  if (!targetKey || ICON_PREFIXES.some((p) => targetKey.startsWith(`files/${p}`))) {
    return listFiles()
  }
  const { data } = await db().from('files').select('url').eq('url', targetKey)
  if (!data || data.length === 0) return listFiles() // no match: nothing to do
  await db().from('files').delete().eq('url', targetKey)
  await deleteByPathname(targetKey).catch(() => {})
  return listFiles()
}

// Delete MANY library files in one atomic row delete (then best-effort blob
// cleanup) — the multi-select path. Site icons are skipped (managed in Settings).
// Returns the authoritative post-delete list.
export async function deleteFilesBatch(urls: string[]): Promise<FileItem[]> {
  const keys = [...new Set(urls.map(fileKey).filter((k): k is string => k !== null))]
    .filter((k) => !ICON_PREFIXES.some((p) => k.startsWith(`files/${p}`)))
  if (keys.length === 0) return listFiles()
  await db().from('files').delete().in('url', keys)
  await Promise.all(keys.map((k) => deleteByPathname(k).catch(() => {})))
  return listFiles()
}

// The site icons (favicon, app icon) uploaded in Settings. They live under
// `files/` on Blob but are NOT `files` rows, so the Files tab lists them
// separately (read-only, tagged "Settings") via this. Newest first.
const ICON_EXT: Record<string, string> = {
  ico: 'image/x-icon', png: 'image/png', jpg: 'image/jpeg', svg: 'image/svg+xml',
  gif: 'image/gif', webp: 'image/webp',
}
export async function getSiteIcons(): Promise<FileItem[]> {
  try {
    const blobs = await listBlobs()
    return blobs
      .filter((b) => ICON_PREFIXES.some((p) => b.pathname.startsWith(`files/${p}`)))
      .map((b) => {
        const name = b.pathname.replace(/^files\//, '')
        const ext = b.pathname.split('.').pop()?.toLowerCase() ?? ''
        // Icon names are `<kind>-<Date.now()>.<ext>` (see uploadIcon) — recover the
        // upload time from that millisecond stamp; fall back to epoch if absent.
        const ms = Number(name.match(/-(\d{10,})\./)?.[1] ?? 0)
        return {
          url: expandBlob(b.pathname),
          filename: name,
          size: b.size,
          contentType: ICON_EXT[ext] ?? 'application/octet-stream',
          uploadedAt: new Date(ms).toISOString(),
        }
      })
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1))
  } catch (error) {
    console.error(`[ERROR] files.getSiteIcons: ${(error as Error).message}`)
    return []
  }
}
