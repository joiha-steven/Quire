import { describe, it, expect } from 'vitest'
import sharp from 'sharp'
import { RASTER, PASSTHROUGH, capOriginal, ORIGINAL_CAP } from '@/lib/image'

// Type routing decides the upload pipeline: RASTER (jpeg/png) keeps the original +
// generates responsive AVIF/WebP variants; PASSTHROUGH (svg/gif/webp/avif) is stored
// as-is. Misclassifying either skips variants for a photo or tries to re-encode a
// vector — so pin the contract. AVIF must be passthrough (already efficient), never raster.
describe('image type classification', () => {
  it('routes jpeg/png through the raster pipeline', () => {
    expect(RASTER.test('image/jpeg')).toBe(true)
    expect(RASTER.test('image/png')).toBe(true)
    expect(PASSTHROUGH.test('image/jpeg')).toBe(false)
  })

  it('keeps vector/animation/efficient formats as passthrough (incl. avif)', () => {
    for (const t of ['image/svg+xml', 'image/gif', 'image/webp', 'image/avif']) {
      expect(PASSTHROUGH.test(t)).toBe(true)
      expect(RASTER.test(t)).toBe(false)
    }
  })

  it('rejects unsupported types from both pipelines', () => {
    for (const t of ['image/heic', 'image/bmp', 'application/pdf', '']) {
      expect(RASTER.test(t)).toBe(false)
      expect(PASSTHROUGH.test(t)).toBe(false)
    }
  })
})

// capOriginal is the hard ceiling: an oversized upload (any cappable format) is
// downscaled to ORIGINAL_CAP px wide, keeping its format; small images and vectors
// pass through byte-for-byte so nothing is needlessly recompressed.
describe('capOriginal — 2048px ceiling on stored originals', () => {
  const raster = (w: number, h: number, fmt: 'png' | 'webp' | 'avif') =>
    sharp({ create: { width: w, height: h, channels: 3, background: { r: 100, g: 120, b: 140 } } })[fmt]().toBuffer()

  it('caps an oversized image to 2048px wide, keeping format', async () => {
    // sharp reports an AVIF buffer's format as its HEIF container.
    const reported = { png: 'png', webp: 'webp', avif: 'heif' } as const
    for (const fmt of ['png', 'webp', 'avif'] as const) {
      const capped = await capOriginal(await raster(4000, 2000, fmt), `image/${fmt}`)
      const meta = await sharp(capped).metadata()
      expect(meta.width).toBe(ORIGINAL_CAP)
      expect(meta.format).toBe(reported[fmt])
    }
  })

  it('leaves an already-small image untouched (same bytes)', async () => {
    const src = await raster(800, 600, 'png')
    const out = await capOriginal(src, 'image/png')
    expect(out.equals(src)).toBe(true)
  })

  it('never touches svg/gif (not cappable)', async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="9000" height="10"/>')
    expect((await capOriginal(svg, 'image/svg+xml')).equals(svg)).toBe(true)
  })
})
