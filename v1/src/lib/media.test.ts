import { describe, it, expect, beforeEach, vi } from 'vitest'

// Regression: finalizeVariants MUST read the original straight from the store (`readBlob`),
// never HTTP-`fetch` the blob URL. On the local driver `blobUrl`/`expandBlob` is a
// store-relative `/uploads/...` path with NO origin, so a server-side `fetch` throws
// "Failed to parse URL" — which broke the upload after() sweep, save-post finalize, and the
// cron sweep on native (users saw upload / save-draft errors). It must also tolerate a
// missing original (skip, never throw) so one bad ref can't 500 a whole save.

const state = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }))
const readBlob = vi.hoisted(() => vi.fn<(p: string) => Promise<Buffer>>())
const uploadFile = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('@/lib/db', () => {
  type Q = Record<string, unknown>
  const makeBuilder = () => {
    let current: Record<string, unknown> | undefined
    let patch: Record<string, unknown> | undefined
    const q: Q = {
      select: () => q,
      update: (p: Record<string, unknown>) => { patch = p; return q },
      eq: (col: string, val: unknown) => {
        current = state.rows.find((r) => r[col] === val)
        if (patch && current) Object.assign(current, patch)
        return q
      },
      maybeSingle: () => Promise.resolve({ data: current ?? null, error: null }),
      then: (res: (v: { data: unknown; error: null }) => unknown) =>
        res({ data: current ? [current] : [], error: null }),
    }
    return q
  }
  return { DB_TAG: 'db', db: () => ({ from: () => makeBuilder() }), liveOnly: (q: unknown) => q }
})

vi.mock('@/lib/blob', () => ({
  readBlob,
  uploadFile,
  blobUrl: (p: string) => `/uploads/${p}`,
  expandBlob: (p: string) => `/uploads/${p}`,
  collapseBlob: (s: string) => s.replace(/^\/uploads\//, ''),
  deleteByPathname: vi.fn(),
  listBlobs: vi.fn(async () => []),
}))

vi.mock('@/lib/image', () => ({
  makeDisplay: vi.fn(async () => [{ suffix: '-1024.webp', data: Buffer.from('x'), contentType: 'image/webp' }]),
  makeThumb: vi.fn(async () => Buffer.from('t')),
  imageSize: vi.fn(async () => ({ width: 10, height: 10 })),
  safeSize: vi.fn(async () => ({ width: 10, height: 10 })),
  capOriginal: vi.fn(async (b: ArrayBuffer | Buffer) => (Buffer.isBuffer(b) ? b : Buffer.from(b))),
  RASTER: /image\/(jpeg|png)/,
  PASSTHROUGH: /never/,
  SIZES: [],
}))

import { finalizeVariants } from '@/lib/media'

describe('finalizeVariants — reads the store directly, never HTTP-fetches the blob URL', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.rows = [{ path: 'media/a.jpg', variants: false }]
  })

  it('finalizes a pending raster via readBlob (no global fetch) and flags variants:true', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    readBlob.mockResolvedValue(Buffer.from('original-bytes'))

    const n = await finalizeVariants(['media/a.jpg'])

    expect(n).toBe(1)
    expect(readBlob).toHaveBeenCalledWith('media/a.jpg')
    expect(uploadFile).toHaveBeenCalledTimes(1) // one display file from the mock
    expect(state.rows[0].variants).toBe(true)
    expect(fetchSpy).not.toHaveBeenCalled() // the bug was a relative-URL fetch
  })

  it('skips (no throw, no upload) when the original is missing from the store', async () => {
    readBlob.mockRejectedValue(new Error('ENOENT'))

    const n = await finalizeVariants(['media/a.jpg'])

    expect(n).toBe(0)
    expect(uploadFile).not.toHaveBeenCalled()
    expect(state.rows[0].variants).toBe(false)
  })
})
