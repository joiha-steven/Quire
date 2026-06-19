// Thin wrapper around @vercel/blob.
// All content (posts + media) lives in Blob; _index.json files are the query layer.

import { put, del, list } from '@vercel/blob'

const COMMON = {
  access: 'public' as const,
  addRandomSuffix: false,
  allowOverwrite: true,
  // Mutable content (the _index.json query layer + post/page .md) is overwritten
  // in place. Blob's default 1-year cache made the CDN serve a STALE index after
  // a save -> new posts 404'd / lists looked empty. 0 keeps reads fresh.
  cacheControlMaxAge: 0,
}

// Bust the Blob CDN cache on reads of mutable content so an overwritten blob is
// never served stale (belt-and-suspenders with cacheControlMaxAge above).
const fresh = (url: string) => `${url}${url.includes('?') ? '&' : '?'}ts=${Date.now()}`

// Token format: vercel_blob_rw_<storeId>_<secret>
// Public URL format: https://<storeId>.public.blob.vercel-storage.com/<pathname>
// Cached at module scope — constant for the lifetime of a deployment.
let _blobBase: string | undefined
function blobBase(): string {
  if (_blobBase) return _blobBase
  const token = process.env.BLOB_READ_WRITE_TOKEN ?? ''
  const m = token.match(/^vercel_blob_rw_([^_]+)_/)
  if (!m) throw new Error('Cannot derive Blob base URL from BLOB_READ_WRITE_TOKEN')
  _blobBase = `https://${m[1]}.public.blob.vercel-storage.com`
  return _blobBase
}

// Construct the deterministic public URL for a pathname without any API call.
export function blobUrl(pathname: string): string {
  return `${blobBase()}/${pathname}`
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

// Read and parse a JSON blob; returns fallback when the blob is missing.
export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(fresh(blobUrl(pathname)), { cache: 'no-store' })
    if (!res.ok) return fallback
    return (await res.json()) as T
  } catch (error) {
    console.error(`[ERROR] blob.readJson(${pathname}): ${(error as Error).message}`)
    throw error
  }
}

// Read a text blob (e.g. markdown); returns null when missing.
export async function readText(pathname: string): Promise<string | null> {
  try {
    const res = await fetch(fresh(blobUrl(pathname)), { cache: 'no-store' })
    if (!res.ok) return null
    return await res.text()
  } catch (error) {
    console.error(`[ERROR] blob.readText(${pathname}): ${(error as Error).message}`)
    throw error
  }
}

// Write a JSON blob at a deterministic pathname.
export async function writeJson(pathname: string, data: unknown): Promise<string> {
  try {
    const { url } = await put(pathname, JSON.stringify(data, null, 2), {
      ...COMMON,
      contentType: 'application/json',
    })
    return url
  } catch (error) {
    console.error(`[ERROR] blob.writeJson(${pathname}): ${(error as Error).message}`)
    throw error
  }
}

// Write a text blob (markdown) at a deterministic pathname.
export async function writeText(
  pathname: string,
  body: string,
  contentType = 'text/markdown',
): Promise<string> {
  try {
    const { url } = await put(pathname, body, { ...COMMON, contentType })
    return url
  } catch (error) {
    console.error(`[ERROR] blob.writeText(${pathname}): ${(error as Error).message}`)
    throw error
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
