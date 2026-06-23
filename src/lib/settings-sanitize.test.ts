import { describe, it, expect } from 'vitest'
import { sanitizeEnabledPalettes, sanitizeComments } from '@/lib/settings-sanitize'
import { ALL_PALETTE_IDS } from '@/lib/themes'

const COMMENTS_OFF = { enabled: false, turnstile: false, googleAuth: false, facebookAuth: false }

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
