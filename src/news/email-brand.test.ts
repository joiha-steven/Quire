import { describe, it, expect } from '@/test/vitest'
import { emailLogo } from '@/news/email-brand'
import { DEFAULT_SETTINGS } from '@/content/settings'
import type { SiteSettings } from '@/types'

// Picking the wrong logo file is silent: the email just shows a broken image in the
// clients that matter. WebP is the site's DERIVED render and is unrenderable in Outlook
// on Windows; SVG is stripped almost everywhere. Both must fall back to the text
// masthead rather than ship a hole in the letterhead.
const settings = (over: Partial<SiteSettings>): SiteSettings => ({ ...DEFAULT_SETTINGS, ...over })

describe('emailLogo', () => {
  const base = 'https://blog.test'

  it('accepts the mail-safe raster formats', () => {
    for (const ext of ['png', 'jpg', 'jpeg', 'gif']) {
      const logo = emailLogo(settings({ showLogo: true, logoUrl: `/uploads/files/logo.${ext}`, logoWidth: 180 }), base)
      expect(logo?.url, ext).toBe(`https://blog.test/uploads/files/logo.${ext}`)
    }
  })

  it('refuses webp and svg when there is no PNG twin — no logo beats a broken one', () => {
    for (const ext of ['webp', 'svg', 'avif']) {
      expect(emailLogo(settings({ showLogo: true, logoUrl: `/uploads/logo.${ext}` }), base), ext).toBeNull()
    }
  })

  // The common case: the site's logo IS a WebP (that is what the web render produces
  // and what most owners upload), so without the twin the masthead would silently be
  // text on almost every real site.
  it('prefers the PNG twin, which rescues a webp/svg source', () => {
    const logo = emailLogo(
      settings({ showLogo: true, logoUrl: '/uploads/media/logo-red.webp', logoEmailUrl: '/uploads/files/logo-1-mail.png' }),
      base,
    )
    expect(logo?.url).toBe('https://blog.test/uploads/files/logo-1-mail.png')
  })

  it('prefers the twin over a mail-safe original too (it is sized for the box)', () => {
    const logo = emailLogo(
      settings({ showLogo: true, logoUrl: '/uploads/original.png', logoEmailUrl: '/uploads/files/logo-1-mail.png' }),
      base,
    )
    expect(logo?.url).toContain('logo-1-mail.png')
  })

  it('is null when the logo is hidden even if a twin exists', () => {
    expect(emailLogo(settings({ showLogo: false, logoUrl: '/l.png', logoEmailUrl: '/t.png' }), base)).toBeNull()
  })

  it('is null when the owner turned the logo off or never set one', () => {
    expect(emailLogo(settings({ showLogo: false, logoUrl: '/uploads/logo.png' }), base)).toBeNull()
    expect(emailLogo(settings({ showLogo: true, logoUrl: '' }), base)).toBeNull()
  })

  it('leaves an already-absolute url alone', () => {
    const logo = emailLogo(settings({ showLogo: true, logoUrl: 'https://cdn.test/logo.png' }), base)
    expect(logo?.url).toBe('https://cdn.test/logo.png')
  })

  it('drops a zero height rather than emitting height="0"', () => {
    const logo = emailLogo(settings({ showLogo: true, logoUrl: '/l.png', logoWidth: 200, logoRenderHeight: 0 }), base)
    expect(logo?.width).toBe(200)
    expect(logo?.height).toBeUndefined()
  })
})
