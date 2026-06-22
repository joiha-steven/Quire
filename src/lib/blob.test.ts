import { describe, it, expect } from 'vitest'
import { blobUrl, collapseBlob, expandBlob } from '@/lib/blob'

// The fake token in vitest.config.ts derives this deterministic store host.
const HOST = 'https://teststore.public.blob.vercel-storage.com'

describe('blob store-relative refs (collapse <-> expand)', () => {
  it('expands a media pathname into an absolute store URL', () => {
    expect(expandBlob('media/photo.jpg')).toBe(`${HOST}/media/photo.jpg`)
  })

  it('expands a files pathname (favicon / app icon) too', () => {
    expect(expandBlob('files/favicon-123.ico')).toBe(`${HOST}/files/favicon-123.ico`)
  })

  it('collapses an absolute store URL back to a store-relative pathname', () => {
    expect(collapseBlob(`${HOST}/media/photo.jpg`)).toBe('media/photo.jpg')
  })

  it('round-trips a bare pathname (collapse after expand is identity)', () => {
    const pathname = 'media/nested/dir/image-1600.avif'
    expect(collapseBlob(expandBlob(pathname))).toBe(pathname)
  })

  it('round-trips an absolute URL (expand after collapse is identity)', () => {
    const url = `${HOST}/media/photo.png`
    expect(expandBlob(collapseBlob(url))).toBe(url)
  })

  it('is idempotent: collapsing an already store-relative string changes nothing', () => {
    expect(collapseBlob('media/photo.jpg')).toBe('media/photo.jpg')
  })

  it('leaves external (non-blob) URLs untouched on expand', () => {
    const external = 'https://example.com/img/banner.jpg'
    expect(expandBlob(external)).toBe(external)
    expect(collapseBlob(external)).toBe(external)
  })

  it('stores a markdown body with NO storeId/host after collapse', () => {
    const body = `Look: ![alt](${HOST}/media/a.jpg) and <img src="${HOST}/media/b.png">`
    const stored = collapseBlob(body)
    expect(stored).not.toContain('teststore')
    expect(stored).not.toContain('public.blob.vercel-storage.com')
    expect(stored).toContain('](media/a.jpg)')
    expect(stored).toContain('src="media/b.png"')
  })

  it('expands media refs inside markdown link/src/href positions only', () => {
    const body = 'text media/loose.jpg ![x](media/a.jpg) <img src="media/b.png">'
    const out = expandBlob(body)
    // link + src positions are rewritten...
    expect(out).toContain(`](${HOST}/media/a.jpg)`)
    expect(out).toContain(`src="${HOST}/media/b.png"`)
    // ...but a loose mention mid-paragraph is NOT (only positional refs expand).
    expect(out).toContain('text media/loose.jpg ')
  })

  it('blobUrl builds the deterministic public URL from the token', () => {
    expect(blobUrl('media/x.webp')).toBe(`${HOST}/media/x.webp`)
  })
})
