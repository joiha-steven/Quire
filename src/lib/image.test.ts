import { describe, it, expect } from 'vitest'
import { RASTER, PASSTHROUGH } from '@/lib/image'

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
