import { describe, it, expect } from 'vitest'
import { blobUrl, collapseBlob, expandBlob } from '@/lib/blob'

// Binaries are served same-origin under /uploads (the local filesystem store).
const BASE = '/uploads'

describe('blob store-relative refs (collapse <-> expand)', () => {
  it('expands a media pathname into a public /uploads URL', () => {
    expect(expandBlob('media/photo.jpg')).toBe(`${BASE}/media/photo.jpg`)
  })

  it('expands a files pathname (favicon / app icon) too', () => {
    expect(expandBlob('files/favicon-123.ico')).toBe(`${BASE}/files/favicon-123.ico`)
  })

  it('collapses a /uploads URL back to a store-relative pathname', () => {
    expect(collapseBlob(`${BASE}/media/photo.jpg`)).toBe('media/photo.jpg')
  })

  it('collapses a /uploads URL carrying an origin too', () => {
    expect(collapseBlob(`https://example.com${BASE}/media/photo.jpg`)).toBe('media/photo.jpg')
  })

  it('round-trips a bare pathname (collapse after expand is identity)', () => {
    const pathname = 'media/nested/dir/image-1600.avif'
    expect(collapseBlob(expandBlob(pathname))).toBe(pathname)
  })

  it('is idempotent: collapsing an already store-relative string changes nothing', () => {
    expect(collapseBlob('media/photo.jpg')).toBe('media/photo.jpg')
  })

  it('leaves external URLs untouched on expand/collapse', () => {
    const external = 'https://example.com/img/banner.jpg'
    expect(expandBlob(external)).toBe(external)
    expect(collapseBlob(external)).toBe(external)
  })

  it('stores a markdown body with NO origin/prefix after collapse', () => {
    const body = `Look: ![alt](${BASE}/media/a.jpg) and <img src="${BASE}/media/b.png">`
    const stored = collapseBlob(body)
    expect(stored).not.toContain('/uploads/')
    expect(stored).toContain('](media/a.jpg)')
    expect(stored).toContain('src="media/b.png"')
  })

  it('expands media refs inside markdown link/src/href positions only', () => {
    const body = 'text media/loose.jpg ![x](media/a.jpg) <img src="media/b.png">'
    const out = expandBlob(body)
    // link + src positions are rewritten...
    expect(out).toContain(`](${BASE}/media/a.jpg)`)
    expect(out).toContain(`src="${BASE}/media/b.png"`)
    // ...but a loose mention mid-paragraph is NOT (only positional refs expand).
    expect(out).toContain('text media/loose.jpg ')
  })

  it('blobUrl builds the deterministic public URL', () => {
    expect(blobUrl('media/x.webp')).toBe(`${BASE}/media/x.webp`)
  })
})
