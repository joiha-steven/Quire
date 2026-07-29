// The four storage figures the dashboard prints, computed once and kept until something is
// written.
//
// They come from a walk of the whole blob store, and the dashboard asked for them on every
// load: 5,120 files on the measuring machine, one `stat` each, 734ms of the dashboard's
// response on a cold cache. Nothing about them changes until the STORE changes, which is a
// narrower event than "something was written": saving a post cannot move these numbers, and
// invalidating on every write would hand the next dashboard visit the whole walk again for
// nothing.
//
// Deliberately NOT computed from the `media` and `files` tables, which would be one cheap
// query: those rows carry the ORIGINAL's size and a has-variants flag, not a row per derived
// file, so the totals would quietly start meaning something narrower than they did. A cache
// that returns the same numbers is a performance change; a query that returns different ones
// is a behaviour change wearing the same label.

import { listBlobs, onBlobWrite } from '@/media/blob'

export type StorageStats = {
  /** Uploaded images, not counting the sizes derived from them. */
  originals: number
  /** Derived files: thumbnails and the display widths, named by convention. */
  variants: number
  /** Attachments under `files/`. */
  files: number
  /** Every byte in the store, derivatives and icons and fonts included. */
  totalBytes: number
}

const isVariant = (p: string) => /-(?:thumb|\d+)\.(?:avif|webp)$/.test(p)

let cached: StorageStats | null = null

export async function storageStats(): Promise<StorageStats> {
  if (cached) return cached
  const blobs = await listBlobs()
  const media = blobs.filter((b) => b.pathname.startsWith('media/') && !b.pathname.endsWith('_index.json'))
  const variants = media.filter((b) => isVariant(b.pathname)).length
  cached = {
    originals: media.length - variants,
    variants,
    files: blobs.filter((b) => b.pathname.startsWith('files/')).length,
    totalBytes: blobs.reduce((sum, b) => sum + b.size, 0),
  }
  return cached
}

/** Exported for the test, which has to prove the walk happens again after an upload. */
export function forgetStorageStats(): void {
  cached = null
}

// Registered at import rather than from the server entry point, unlike the cache warmer:
// this listener only nulls a variable, so nothing pays for it, and a script that forgot to
// register it would print stale numbers.
onBlobWrite(forgetStorageStats)
