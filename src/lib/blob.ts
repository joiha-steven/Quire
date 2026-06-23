// Binary storage facade — BINARIES ONLY. Text lives in Postgres (db.ts). Image
// refs are stored store-relative (e.g. `media/x.webp`) and re-expanded on read so
// the store can change without rewriting content (Invariant 3).
//
// Two drivers, picked by STORAGE_DRIVER:
//   - 'vercel-blob' (default) — Vercel Blob, browser uploads straight to the store.
//   - 'local'                 — files on disk (Docker / self-host), served under
//                                /uploads by app/uploads/[...path]/route.ts.
// Pure URL/rewrite helpers below stay filesystem-free; the IO helpers dispatch to
// the local driver via a dynamic import() so node:fs never reaches a client bundle.
// This is the ONLY file allowed to import `@vercel/blob` (enforced by
// scripts/checks/no-direct-blob.mjs) — everything else goes through this facade.

import { put, del, list } from '@vercel/blob'

const LOCAL = process.env.STORAGE_DRIVER === 'local'
const LOCAL_BASE = '/uploads' // serving-route prefix; also the public URL prefix

// --- Vercel Blob base URL (pure) -------------------------------------------------
// Token: vercel_blob_rw_<storeId>_<secret> → host <storeId>.public.blob...
let _blobBase: string | undefined
function vercelBase(): string {
  if (_blobBase) return _blobBase
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? ''
  const m = token.match(/^vercel_blob_rw_([^_]+)_/)
  if (!m) throw new Error('Cannot derive Blob base URL from BLOB_READ_WRITE_TOKEN')
  // Lowercase host (token id is mixed-case) → avoids duplicate-URL SEO.
  _blobBase = `https://${m[1].toLowerCase()}.public.blob.vercel-storage.com`
  return _blobBase
}

// Host/prefix matcher for collapse: any Vercel Blob store host OR the local
// `/uploads/` prefix (with or without an origin) → content stays portable across a
// provider/host change (so a Vercel→local restore keeps rendering).
const STORE_PREFIX_RE = /https?:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/|(?:https?:\/\/[^/]+)?\/uploads\//gi

// Expand store-relative `media/`/`files/` refs to `${base}/...` (idempotent;
// external links + body text outside link/src/href positions untouched).
function expandWith(base: string, s: string): string {
  if (/^(media|files)\//.test(s)) return `${base}/${s}`
  return s
    .replace(/(\]\()(media\/[^)\s]+)/g, (_m, a, p) => `${a}${base}/${p}`)
    .replace(/((?:src|href)=["'])(media\/[^"']+)/g, (_m, a, p) => `${a}${base}/${p}`)
}

// --- Public URL helpers (pure) ---------------------------------------------------

// Deterministic public URL for a pathname (no API call). THE public media URL.
export function blobUrl(pathname: string): string {
  return LOCAL ? `${LOCAL_BASE}/${pathname}` : `${vercelBase()}/${pathname}`
}

// Public media origin (for a <link rel="preconnect">). Empty for local (same
// origin → no preconnect) or when the Blob base is unavailable.
export function blobOrigin(): string {
  if (LOCAL) return ''
  try {
    return vercelBase()
  } catch {
    return ''
  }
}

// Persist form: strip the store host/prefix → store-relative pathname. Idempotent.
export function collapseBlob(s: string): string {
  return s.replace(STORE_PREFIX_RE, '')
}

// Render form: pathname → public URL. Idempotent; external links untouched.
export function expandBlob(s: string): string {
  if (LOCAL) return expandWith(LOCAL_BASE, s)
  let base: string
  try {
    base = vercelBase()
  } catch {
    return s
  }
  return expandWith(base, s)
}

// --- IO helpers (server-only; local driver lazy-loaded) --------------------------

// List every blob (pathname + size). Used for site stats and backups.
export async function listBlobs(): Promise<{ pathname: string; size: number }[]> {
  if (LOCAL) return (await import('./blob-local')).list()
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

// Upload a binary and return its public URL.
export async function uploadFile(
  pathname: string,
  body: ArrayBuffer | Buffer,
  contentType: string,
): Promise<string> {
  try {
    if (LOCAL) return (await import('./blob-local')).put(pathname, body)
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

// Read a binary back by pathname (used by the backup builder). Local reads disk;
// Vercel fetches the immutable public URL.
export async function readBlob(pathname: string): Promise<Buffer> {
  if (LOCAL) return (await import('./blob-local')).read(pathname)
  const res = await fetch(blobUrl(pathname))
  if (!res.ok) throw new Error(`fetch blob ${pathname}: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

// Delete a blob by pathname. No-op when missing (idempotent).
export async function deleteByPathname(pathname: string): Promise<void> {
  try {
    if (LOCAL) {
      await (await import('./blob-local')).del(pathname)
      return
    }
    await del(blobUrl(pathname))
  } catch (error) {
    console.error(`[ERROR] blob.deleteByPathname(${pathname}): ${(error as Error).message}`)
    throw error
  }
}

// Delete a blob by its public URL.
export async function deleteByUrl(url: string): Promise<void> {
  await deleteByPathname(collapseBlob(url))
}
