// Thin wrapper around @vercel/blob.
// All content (posts + media) lives in Blob; _index.json files are the query layer.

import { put, del, list } from '@vercel/blob'

const COMMON = {
  access: 'public' as const,
  addRandomSuffix: false,
  allowOverwrite: true,
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

// Resolve the public URL for a known pathname, or null if it does not exist.
export async function resolveUrl(pathname: string): Promise<string | null> {
  try {
    const { blobs } = await list({ prefix: pathname, limit: 1 })
    const hit = blobs.find((b) => b.pathname === pathname)
    return hit?.url ?? null
  } catch (error) {
    console.error(`[ERROR] blob.resolveUrl(${pathname}): ${(error as Error).message}`)
    throw error
  }
}

// Read and parse a JSON blob; returns fallback when the blob is missing.
export async function readJson<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const url = await resolveUrl(pathname)
    if (!url) return fallback
    const res = await fetch(url, { cache: 'no-store' })
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
    const url = await resolveUrl(pathname)
    if (!url) return null
    const res = await fetch(url, { cache: 'no-store' })
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

// Delete a blob by pathname (resolves URL first). No-op when missing.
export async function deleteByPathname(pathname: string): Promise<void> {
  const url = await resolveUrl(pathname)
  if (url) await deleteByUrl(url)
}
