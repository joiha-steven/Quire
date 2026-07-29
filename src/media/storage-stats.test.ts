// The point of the cache is that the walk stops happening; the point of the test is that it
// starts again when the store changes. Both halves fail silently in production: a walk that
// never repeats prints numbers that are quietly wrong, and one that repeats on every read
// puts the cost straight back.

import { afterAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const DIR = mkdtempSync(join(tmpdir(), 'quire-storage-'))
process.env.STORAGE_LOCAL_DIR = DIR

// Imported AFTER the environment is set: the local driver resolves its directory once, at
// module load, so an import above this line would write into the repository's own uploads.
const { uploadFile, deleteByPathname } = await import('@/media/blob')
const { storageStats, forgetStorageStats } = await import('@/media/storage-stats')

const png = Buffer.from('not really a png, and nothing here decodes it')

afterAll(() => rmSync(DIR, { recursive: true, force: true }))

describe('storageStats', () => {
  beforeEach(forgetStorageStats)

  test('counts originals, variants and attachments apart', async () => {
    await uploadFile('media/photo.webp', png, 'image/webp')
    await uploadFile('media/photo-thumb.webp', png, 'image/webp')
    await uploadFile('media/photo-1024.avif', png, 'image/avif')
    await uploadFile('files/notes.pdf', png, 'application/pdf')

    const stats = await storageStats()
    expect(stats.originals).toBe(1)
    expect(stats.variants).toBe(2)
    expect(stats.files).toBe(1)
    expect(stats.totalBytes).toBe(png.byteLength * 4)
  })

  test('an upload invalidates the cached figures', async () => {
    const before = await storageStats()
    // No `forgetStorageStats()` here, deliberately: the write itself has to be what makes
    // the next read see the new file. That is the whole contract with `onBlobWrite`.
    await uploadFile('media/second.webp', png, 'image/webp')
    const after = await storageStats()
    expect(after.originals).toBe(before.originals + 1)
    expect(after.totalBytes).toBe(before.totalBytes + png.byteLength)
  })

  test('a delete invalidates them too', async () => {
    const before = await storageStats()
    await deleteByPathname('media/second.webp')
    const after = await storageStats()
    expect(after.originals).toBe(before.originals - 1)
  })

  test('a repeat read does not walk the store again', async () => {
    await storageStats()
    // Written behind the facade, so nothing announced it. A second call that still reports
    // the old total is the cache doing its job; one that notices this file is the walk
    // running on every dashboard load again.
    const { promises: fs } = await import('node:fs')
    await fs.writeFile(join(DIR, 'media', 'unannounced.webp'), png)
    const cached = await storageStats()
    forgetStorageStats()
    const fresh = await storageStats()
    expect(fresh.originals).toBe(cached.originals + 1)
  })
})
