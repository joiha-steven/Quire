import { describe, it, expect } from '@/test/vitest'
import { sanitizeEnabledPalettes, sanitizeComments, sanitizeThemes, sanitizeFontUrl, sanitizeHome, sanitizeListPath } from '@/content/settings-sanitize'
import { ALL_PALETTE_IDS, defaultThemes } from '@/content/themes'

const COMMENTS_OFF = { enabled: false, turnstile: false, googleAuth: false }

describe('sanitizeComments', () => {
  it('falls back to defaults for a missing / malformed object', () => {
    expect(sanitizeComments(undefined, COMMENTS_OFF)).toEqual(COMMENTS_OFF)
    expect(sanitizeComments('nope', COMMENTS_OFF)).toEqual(COMMENTS_OFF)
  })

  it('keeps booleans and ignores non-boolean fields', () => {
    expect(sanitizeComments({ enabled: true, turnstile: 'yes' }, COMMENTS_OFF)).toEqual({
      ...COMMENTS_OFF,
      enabled: true,
    })
  })
})

// `enabledPalettes` is the visitor-switcher allow-list. Invariants pinned here:
// the default is ALWAYS included (so the switcher never goes empty), only known
// preset ids survive, preset order is preserved, and a missing field (legacy
// settings) means "all on".
describe('sanitizeEnabledPalettes', () => {
  it('defaults to ALL palettes when the field is missing / not an array', () => {
    expect(sanitizeEnabledPalettes(undefined, 'mono')).toEqual(ALL_PALETTE_IDS)
    expect(sanitizeEnabledPalettes(null, 'mono')).toEqual(ALL_PALETTE_IDS)
    expect(sanitizeEnabledPalettes('mono', 'mono')).toEqual(ALL_PALETTE_IDS)
  })

  it('always includes the default, even if absent from the input', () => {
    expect(sanitizeEnabledPalettes(['ocean'], 'mono')).toContain('mono')
    // empty array collapses to just the default -> switcher hides (one option)
    expect(sanitizeEnabledPalettes([], 'sepia')).toEqual(['sepia'])
  })

  it('keeps only known preset ids, in preset order', () => {
    const out = sanitizeEnabledPalettes(['amber', 'bogus', 'ocean', 42, 'mono'], 'mono')
    expect(out).not.toContain('bogus')
    expect(out).toEqual(ALL_PALETTE_IDS.filter((id) => ['amber', 'ocean', 'mono'].includes(id)))
  })

  it('falls back to the built-in default when the given default is invalid', () => {
    expect(sanitizeEnabledPalettes(['ocean'], 'not-a-preset')).toContain('mono')
  })
})

// `accent` shipped after the palettes did. A settings row saved before it has no
// accent key, so the sanitizer must invent one — otherwise the CSS var lands empty
// and every accent mark paints transparent.
describe('sanitizeColors: accent back-compat', () => {
  it('seeds a missing accent from the RESOLVED link colour', () => {
    const out = sanitizeThemes({ mono: { light: { link: '#ff0000' }, dark: {} } }, defaultThemes())
    expect(out.mono.light.accent).toBe('#ff0000')
  })

  it('keeps an explicit accent over the link colour', () => {
    const out = sanitizeThemes({ mono: { light: { link: '#ff0000', accent: '#00ff00' } } }, defaultThemes())
    expect(out.mono.light.accent).toBe('#00ff00')
  })

  it('never leaves accent empty, for any palette or mode', () => {
    for (const theme of Object.values(sanitizeThemes({}, defaultThemes()))) {
      expect(theme.light.accent).toMatch(/^#[0-9a-f]{6}$/i)
      expect(theme.dark.accent).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

// A font src url lands raw in `@font-face { src: url(<here>) }`, so a hostile value
// must not smuggle a scheme or break out of `url()`.
describe('sanitizeFontUrl', () => {
  it('accepts a store-relative path and an http(s) url', () => {
    expect(sanitizeFontUrl('/uploads/files/font.woff2')).toBe('/uploads/files/font.woff2')
    expect(sanitizeFontUrl('https://cdn.example.com/f.woff2')).toBe('https://cdn.example.com/f.woff2')
  })

  it('rejects javascript:/data: schemes and url()-breaking characters', () => {
    expect(sanitizeFontUrl('javascript:alert(1)')).toBe('')
    expect(sanitizeFontUrl('data:font/woff2;base64,AAAA')).toBe('')
    expect(sanitizeFontUrl('/x.woff2") ; } body{display:none}')).toBe('')
    expect(sanitizeFontUrl('/a b.woff2')).toBe('')
    expect(sanitizeFontUrl(42)).toBe('')
    expect(sanitizeFontUrl('')).toBe('')
  })
})

// ADR 0014. The mode decides what `/` serves, so an unreadable value has to land on the
// one option that changes nothing rather than on whatever the string happened to say.
describe('sanitizeHome', () => {
  const FALLBACK = { mode: 'list' as const, page: '', listPath: '/post' }

  it('falls back to the list for anything it does not recognise', () => {
    expect(sanitizeHome(undefined, FALLBACK).mode).toBe('list')
    expect(sanitizeHome({ mode: 'front' }, FALLBACK).mode).toBe('list')
    expect(sanitizeHome({ mode: 42 }, FALLBACK).mode).toBe('list')
  })

  it('keeps a page mode and strips the slug of leading slashes', () => {
    expect(sanitizeHome({ mode: 'page', page: '/welcome' }, FALLBACK))
      .toEqual({ mode: 'page', page: 'welcome', listPath: '/post' })
  })
})

describe('sanitizeListPath', () => {
  it('normalises to exactly one leading slash and one lowercase segment', () => {
    expect(sanitizeListPath('blog', '/post')).toBe('/blog')
    expect(sanitizeListPath('//Writing//', '/post')).toBe('/writing')
  })

  // A path the router could not mount, or one that would need a second reservation rule.
  it('rejects a nested, empty or malformed path', () => {
    expect(sanitizeListPath('/a/b', '/post')).toBe('/post')
    expect(sanitizeListPath('/', '/post')).toBe('/post')
    expect(sanitizeListPath('-lead', '/post')).toBe('/post')
    expect(sanitizeListPath(7, '/post')).toBe('/post')
  })
})
