// Thin @vercel/blob wrapper — BINARIES ONLY. Text lives in Postgres (db.ts). Image
// refs stored store-relative + re-expanded on read so the store can change without
// rewriting content.

import { put, del, list } from '@vercel/blob'

// Token: vercel_blob_rw_<storeId>_<secret> → host <storeId>.public.blob...
// Cached at module scope (constant per deployment).
let _blobBase: string | undefined
function blobBase(): string {
  if (_blobBase) return _blobBase
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? ''
  const m = token.match(/^vercel_blob_rw_([^_]+)_/)
  if (!m) throw new Error('Cannot derive Blob base URL from BLOB_READ_WRITE_TOKEN')
  // Lowercase host (token id is mixed-case) → avoids duplicate-URL SEO.
  _blobBase = `https://${m[1].toLowerCase()}.public.blob.vercel-storage.com`
  return _blobBase
}

// Deterministic public URL for a pathname (no API call). Also THE public media URL.
export function blobUrl(pathname: string): string {
  return `${blobBase()}/${pathname}`
}

// Public media origin (for a <link rel="preconnect">), or '' when unavailable.
export function blobOrigin(): string {
  try {
    return blobBase()
  } catch {
    return ''
  }
}

// Matches any Vercel Blob store host (a provider change needs only a new token).
function blobHostRe(): RegExp {
  return /https?:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//gi
}

// Persist form: strip the store host → store-relative pathname. Idempotent; works
// on a bare value or a markdown body.
export function collapseBlob(s: string): string {
  return s.replace(blobHostRe(), '')
}

// Render form: pathname → absolute Blob URL. Idempotent; external links untouched.
export function expandBlob(s: string): string {
  let base: string
  try {
    base = blobBase()
  } catch {
    return s
  }
  // Whole value is a blob pathname: media (uploads) or files (favicon / app icon).
  if (/^(media|files)\//.test(s)) return `${base}/${s}`
  return s // markdown body: only expand media refs in link / src / href positions
    .replace(/(\]\()(media\/[^)\s]+)/g, (_m, a, p) => `${a}${base}/${p}`)
    .replace(/((?:src|href)=["'])(media\/[^"']+)/g, (_m, a, p) => `${a}${base}/${p}`)
}

// List every blob (pathname + size), following pagination. Used for site stats.
export async function listBlobs(): Promise<{ pathname: string; size: number }[]> {
  const out: { pathname: string; size: number }[] = []
  let cursor: string | undefined
  try {
    do {
      const res = await list({ cursor, limit: 1000 })
      for (const b of res.blobs) out.push({ pathname: b.pathname, size: b.size })
      cursor = res.cursor
    } while (cursor)
    return out
  } catch (error) {
    console.error(`[ERROR] blob.listBlobs: ${(error as Error).message}`)
    return out
  }
}

// Upload a binary file (media) and return its public URL.
export async function uploadFile(
  pathname: string,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  try {
    const { url } = await put(pathname, body, {
      access: 'public',
      addRandomSuffix: false,
      // Names are made unique up-front (freePathname + listBlobs); this only avoids
      // a hard "blob already exists" throw on a stale name pick.
      allowOverwrite: true,
      contentType,
    })
    return url
  } catch (error) {
    console.error(`[ERROR] blob.uploadFile(${pathname}): ${(error as Error).message}`)
    throw error
  }
}

// Delete a blob by its public URL.
export async function deleteByUrl(url: string): Promise<void> {
  try {
    await del(url)
  } catch (error) {
    console.error(`[ERROR] blob.deleteByUrl(${url}): ${(error as Error).message}`)
    throw error
  }
}

// Delete a blob by pathname. No-op when missing (del is idempotent).
export async function deleteByPathname(pathname: string): Promise<void> {
  await deleteByUrl(blobUrl(pathname))
}
