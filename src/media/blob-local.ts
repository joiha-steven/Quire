// Local-filesystem storage driver — the self-host / Docker binary store. Provides the
// IO surface the storage facade expects (put / read / list / del), writing files
// straight to a mounted directory (STORAGE_LOCAL_DIR, default ./uploads). Reached only
// through a dynamic import() from `blob.ts` so node:fs never lands in a client bundle.
// SERVER-ONLY.
//
// Files are served back over HTTP by app/uploads/[...path]/route.ts under the
// `/uploads` prefix, which is the same prefix blob.ts uses to build public URLs.

import { promises as fs, createReadStream, mkdirSync } from 'node:fs'
import { Readable } from 'node:stream'
import path from 'node:path'

// Read at USE, not at import. In the Docker image cwd is /app, so the default maps to
// /app/uploads — mount a volume there to persist binaries across deploys.
//
// It was a module-level `const`, which made the value depend on WHEN this file was first
// imported. That is invisible in production, where the environment is set before anything
// loads, and it silently broke a test: `bun test` shares one module registry across files, so
// a suite that set `STORAGE_LOCAL_DIR` and then imported this got whatever an earlier file
// had already frozen in — and wrote its fixtures into the repository's own uploads directory.
// A getenv per file operation is noise next to the I/O it precedes.
const storeDir = (): string => path.resolve(process.env.STORAGE_LOCAL_DIR || './uploads')

/**
 * Create the store if it is not there yet. Called at boot.
 *
 * A fresh install has no `uploads/` until something is uploaded, and `/api/health` checks
 * that the directory is WRITABLE — so a brand-new instance answered 503 and a reverse proxy
 * in front of it would refuse to route to it, before anyone had done anything wrong. CI
 * caught this on a clean checkout; every developer machine already had the directory from
 * the first time it ran.
 *
 * Read-only rather than throwing: a read-only mount is a real deployment, and the health
 * probe is the right place to report it.
 */
export function ensureBlobStore(): void {
  try {
    mkdirSync(storeDir(), { recursive: true })
  } catch {
    /* health reports it */
  }
}

// Confine every pathname under the store directory — a stored ref like `media/x.webp` must never
// escape via `..` into the rest of the container filesystem.
export function resolveSafe(pathname: string): string {
  const base = storeDir()
  const abs = path.resolve(base, pathname)
  if (abs !== base && !abs.startsWith(base + path.sep)) throw new Error(`Invalid blob path: ${pathname}`)
  return abs
}

// Write a binary and return its store-relative public URL. `exclusive` uses an
// O_EXCL write (flag 'wx') that FAILS with EEXIST if the file already exists —
// the atomic gate that lets two concurrent uploads racing for the same name never
// overwrite each other (the loser retries a fresh name). Derivatives (thumb/variants)
// write without it, so a re-run harmlessly overwrites its own identical bytes.
export async function put(
  pathname: string,
  body: ArrayBuffer | Buffer,
  opts?: { exclusive?: boolean },
): Promise<string> {
  const abs = resolveSafe(pathname)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body)
  await fs.writeFile(abs, buf, opts?.exclusive ? { flag: 'wx' } : undefined)
  return `/uploads/${pathname}`
}

// Read a binary back (used by backup + small whole-file reads).
export function read(pathname: string): Promise<Buffer> {
  return fs.readFile(resolveSafe(pathname))
}

// Size of a stored binary (throws when missing) — the serving route needs it for
// Content-Length and byte-range bounds.
export async function statSize(pathname: string): Promise<number> {
  const s = await fs.stat(resolveSafe(pathname))
  if (!s.isFile()) throw new Error(`Not a file: ${pathname}`)
  return s.size
}

// Stream a stored binary (optionally a byte range, inclusive bounds) as a web
// ReadableStream — the serving route pipes this straight into the Response so a
// large video never sits fully in memory the way read() would put it there.
export function stream(pathname: string, range?: { start: number; end: number }): ReadableStream {
  const rs = createReadStream(resolveSafe(pathname), range)
  // Through `unknown`: node:stream/web and the DOM both declare a ReadableStream and the
  // two are not assignable to each other. The server project has no DOM lib so the direct
  // cast compiled there, and only failed once the admin project — which does have DOM —
  // started following this file through a type import.
  return Readable.toWeb(rs) as unknown as ReadableStream
}

// Delete a binary. No-op when missing.
export async function del(pathname: string): Promise<void> {
  await fs.rm(resolveSafe(pathname), { force: true })
}

// List every stored binary (pathname + size), walking the directory tree.
export async function list(): Promise<{ pathname: string; size: number }[]> {
  const out: { pathname: string; size: number }[] = []
  const walk = async (dir: string, base: string): Promise<void> => {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return // dir does not exist yet → no blobs
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name)
      const rel = base ? `${base}/${e.name}` : e.name
      if (e.isDirectory()) await walk(abs, rel)
      else {
        const { size } = await fs.stat(abs)
        out.push({ pathname: rel, size })
      }
    }
  }
  await walk(storeDir(), '')
  return out
}
