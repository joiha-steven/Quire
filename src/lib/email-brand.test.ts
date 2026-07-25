import { describe, it, expect } from 'vitest'
import { emailLogo } from '@/lib/email-brand'
import { DEFAULT_SETTINGS } from '@/lib/settings'
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

  it('refuses webp and svg — no email logo is better than a broken one', () => {
    for (const ext of ['webp', 'svg', 'avif']) {
      expect(emailLogo(settings({ showLogo: true, logoUrl: `/uploads/logo.${ext}` }), base), ext).toBeNull()
    }
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
