// Image encoding — pure sharp pipeline (Buffer -> Buffer / dimensions). No DB, no
// Blob, no app state. media.ts depends on this ONE WAY (media -> image, never back).

import sharp from 'sharp'

export const RASTER = /^image\/(jpeg|png)$/ // full responsive pipeline
export const PASSTHROUGH = /^image\/(svg\+xml|gif|webp)$/ // stored as-is, no variants
export const SIZES = [1024, 1600] as const // display widths (in-column / wider)
const THUMB_WIDTH = 400

export type Variant = { suffix: string; data: Buffer; contentType: string }

// From the original bytes, read pixel dimensions (auto-oriented).
export async function imageSize(original: Buffer): Promise<{ width: number; height: number }> {
  const meta = await sharp(original, { failOn: 'none' }).rotate().metadata()
  return { width: meta.width ?? 0, height: meta.height ?? 0 }
}

// Pixel dimensions for any image we can decode (raster + webp/gif, and most svg).
export async function safeSize(buf: Buffer): Promise<{ width?: number; height?: number }> {
  try {
    const { width, height } = await imageSize(buf)
    return width && height ? { width, height } : {}
  } catch {
    return {}
  }
}

// Small library thumbnail — cheap, made on upload so the grid renders at once.
export async function makeThumb(original: Buffer): Promise<Buffer> {
  return sharp(original, { failOn: 'none' })
    .rotate()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer()
}

// The heavy display set (AVIF + WebP @ each size) — deferred to AFTER save so the
// save request never blocks on the AVIF encode (the original always renders).
export async function makeDisplay(original: Buffer): Promise<Variant[]> {
  const { width: ow } = await imageSize(original)
  const files: Variant[] = []
  for (const w of SIZES) {
    const pipe = sharp(original, { failOn: 'none' })
      .rotate()
      .resize({ width: ow ? Math.min(w, ow) : w, withoutEnlargement: true })
    files.push({ suffix: `-${w}.webp`, data: await pipe.clone().webp({ quality: 80 }).toBuffer(), contentType: 'image/webp' })
    files.push({ suffix: `-${w}.avif`, data: await pipe.clone().avif({ quality: 50 }).toBuffer(), contentType: 'image/avif' })
  }
  return files
}
