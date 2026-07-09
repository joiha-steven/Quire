// Binary storage facade — BINARIES ONLY. Text lives in Postgres (db.ts). Image
// refs are stored store-relative (e.g. `media/x.webp`) and re-expanded on read so
// the store path can change without rewriting content (Invariant 3).
//
// Storage is the local filesystem: binaries live under STORAGE_LOCAL_DIR and are
// served at /uploads by app/uploads/[...path]/route.ts. The pure URL/rewrite helpers
// below stay filesystem-free (safe in a client bundle); the IO helpers dispatch to
// the local driver (blob-local.ts) via a dynamic import() so node:fs never reaches a
// client bundle. No src file may import a cloud storage SDK (check:no-direct-blob).

const LOCAL_BASE = '/uploads' // serving-route prefix; also the public URL prefix

// Strip the `/uploads/` prefix (with or without an origin) → store-relative pathname,
// so stored content carries no origin and renders after a host change (Invariant 3).
const STORE_PREFIX_RE = /(?:https?:\/\/[^/]+)?\/uploads\//gi

// Expand store-relative `media/`/`files/` refs to `${base}/...` (idempotent;
// external links + body text outside link/src/href positions untouched).
function expandWith(base: string, s: string): string {
  if (/^(media|files)\//.test(s)) return `${base}/${s}`
  return s
    .replace(/(\]\()(media\/[^)\s]+)/g, (_m, a, p) => `${a}${base}/${p}`)
    .replace(/((?:src|href)=["'])(media\/[^"']+)/g, (_m, a, p) => `${a}${base}/${p}`)
}

// --- Public URL helpers (pure) ---------------------------------------------------

// Deterministic public URL for a pathname (no IO). THE public media URL.
export function blobUrl(pathname: string): string {
  return `${LOCAL_BASE}/${pathname}`
}

// Persist form: strip the store prefix → store-relative pathname. Idempotent.
export function collapseBlob(s: string): string {
  return s.replace(STORE_PREFIX_RE, '')
}

// Render form: pathname → public URL. Idempotent; external links untouched.
export function expandBlob(s: string): string {
  return expandWith(LOCAL_BASE, s)
}

// --- IO helpers (server-only; local driver lazy-loaded to keep node:fs off the client) ---

// List every stored binary (pathname + size). Used for site stats and backups.
export async function listBlobs(): Promise<{ pathname: string; size: number }[]> {
  return (await import('./blob-local')).list()
}

// Upload a binary and return its public URL. `_contentType` is part of the facade
// signature but unused by the local driver (MIME is derived from the path on serve).
export async function uploadFile(
  pathname: string,
  body: ArrayBuffer | Buffer,
  _contentType: string,
): Promise<string> {
  try {
    return (await import('./blob-local')).put(pathname, body)
  } catch (error) {
    console.error(`[ERROR] blob.uploadFile(${pathname}): ${(error as Error).message}`)
    throw error
  }
}

// Read a binary back by pathname (used by the backup builder).
export async function readBlob(pathname: string): Promise<Buffer> {
  return (await import('./blob-local')).read(pathname)
}

// Delete a binary by pathname. No-op when missing (idempotent).
export async function deleteByPathname(pathname: string): Promise<void> {
  try {
    await (await import('./blob-local')).del(pathname)
  } catch (error) {
    console.error(`[ERROR] blob.deleteByPathname(${pathname}): ${(error as Error).message}`)
    throw error
  }
}
