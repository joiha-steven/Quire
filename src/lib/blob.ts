// Thin wrapper around @vercel/blob — BINARIES ONLY (images, attachments, icons).
// All text content (posts/pages/settings/media metadata) lives in Postgres now
// (see `db.ts`). Image refs are stored store-relative and re-expanded on read so
// the binary store can change (e.g. -> Cloudflare R2) without rewriting content.

import { put, del, list } from '@vercel/blob'

// Token format: vercel_blob_rw_<storeId>_<secret>
// Public URL format: https://<storeId>.public.blob.vercel-storage.com/<pathname>
// Cached at module scope — constant for the lifetime of a deployment.
let _blobBase: string | undefined
function blobBase(): string {
  if (_blobBase) return _blobBase
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? ''
  const m = token.match(/^vercel_blob_rw_([^_]+)_/)
  if (!m) throw new Error('Cannot derive Blob base URL from BLOB_READ_WRITE_TOKEN')
  // Lowercase: the store id in the token is mixed-case but the public host is
  // lowercase; rendering the canonical lowercase host avoids duplicate-URL SEO.
  _blobBase = `https://${m[1].toLowerCase()}.public.blob.vercel-storage.com`
  return _blobBase
}

// Construct the deterministic public URL for a pathname without any API call.
// Token-derived (store host) — this is THE public media URL too: images are served
// straight from the Vercel Blob store host (no vanity domain / proxy).
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

// Matches any Vercel Blob store host so a stored URL collapses to a store-relative
// path (e.g. `media/x.webp`). Region/store changes survive this; a provider change
// needs only a new token. (Legacy vanity-domain URLs were already normalized to
// store-relative during the Postgres migration, so only the store host is matched.)
function blobHostRe(): RegExp {
  return /https?:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\//gi
}

// Persist form: strip the store host so only the store-relative pathname is stored
// (e.g. `media/x.webp`). Idempotent; works on a bare value or a markdown body. This
// is what decouples stored content from any specific Blob store/domain.
export function collapseBlob(s: string): string {
  return s.replace(blobHostRe(), '')
}

// Render form: turn a stored pathname back into an absolute Blob URL. Idempotent —
// absolute URLs and external links are left untouched. Handles a bare field value
// and `media/...` refs inside a markdown/HTML body.
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
      // Safety net: a derived name is made unique up-front (freePathname +
      // listBlobs), so this never silently replaces a distinct image. It only
      // prevents a hard "blob already exists" throw if a stale manifest read ever
      // picks a name that already exists in the store.
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
