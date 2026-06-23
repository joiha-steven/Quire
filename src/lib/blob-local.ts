// Local-filesystem storage driver — the self-host / Docker binary store. Mirrors
// the IO surface Vercel Blob provides (put / read / list / del), but writes files
// straight to a mounted directory (STORAGE_LOCAL_DIR, default ./uploads). Selected
// at runtime by `blob.ts` when STORAGE_DRIVER=local, and ALWAYS reached through a
// dynamic import() so node:fs never lands in a client bundle. SERVER-ONLY.
//
// Files are served back over HTTP by app/uploads/[...path]/route.ts under the
// `/uploads` prefix, which is the same prefix blob.ts uses to build public URLs.

import { promises as fs } from 'node:fs'
import path from 'node:path'

// Resolved once; in the Docker standalone image cwd is /app, so the default maps
// to /app/uploads — mount a volume there to persist binaries across deploys.
const DIR = path.resolve(process.env.STORAGE_LOCAL_DIR || './uploads')

// Confine every pathname under DIR — a stored ref like `media/x.webp` must never
// escape via `..` into the rest of the container filesystem.
export function resolveSafe(pathname: string): string {
  const abs = path.resolve(DIR, pathname)
  if (abs !== DIR && !abs.startsWith(DIR + path.sep)) throw new Error(`Invalid blob path: ${pathname}`)
  return abs
}

// Write a binary and return its store-relative public URL.
export async function put(pathname: string, body: ArrayBuffer | Buffer): Promise<string> {
  const abs = resolveSafe(pathname)
  await fs.mkdir(path.dirname(abs), { recursive: true })
  await fs.writeFile(abs, Buffer.isBuffer(body) ? body : Buffer.from(body))
  return `/uploads/${pathname}`
}

// Read a binary back (used by backup + the serving route).
export function read(pathname: string): Promise<Buffer> {
  return fs.readFile(resolveSafe(pathname))
}

// Delete a binary. No-op when missing (mirrors Vercel `del`).
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
  await walk(DIR, '')
  return out
}
