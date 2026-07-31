// Code generation only. Redemption needs a database and argon2 and lives in the auth flow
// test; what is worth pinning here is the shape of the draw, because rejection sampling is
// a loop and a loop can hand back a short code or spin forever without any caller noticing.
import { describe, it, expect } from 'bun:test'
import { generateCode, normalizeCode } from '@/auth/recovery'

const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

describe('generateCode', () => {
  it('is always ten alphabet characters in two groups of five', () => {
    for (let i = 0; i < 2000; i++) expect(generateCode()).toMatch(/^[23456789A-HJKMNP-TV-Z]{5}-[23456789A-HJKMNP-TV-Z]{5}$/)
  })

  it('never emits a character the alphabet excludes', () => {
    // The characters left out on purpose: I, 1, O, 0, L, U. A rejection loop that runs off
    // the end of the alphabet would surface here as `undefined` in the string.
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) for (const c of generateCode().replace('-', '')) seen.add(c)
    for (const c of seen) expect(ALPHABET).toContain(c)
  })

  it('reaches every letter, including the ones past the rejection ceiling', () => {
    // Bytes >= 240 are re-drawn. Get that bound wrong by truncating instead of rejecting
    // and the tail of the alphabet simply never appears.
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) for (const c of generateCode().replace('-', '')) seen.add(c)
    expect(seen.size).toBe(ALPHABET.length)
  })
})

describe('normalizeCode', () => {
  it('accepts what someone actually types: case, spaces, a missing or doubled hyphen', () => {
    expect(normalizeCode('abcde-fghjk')).toBe('ABCDE-FGHJK')
    expect(normalizeCode('ABCDEFGHJK')).toBe('ABCDE-FGHJK')
    expect(normalizeCode(' abcde - fghjk ')).toBe('ABCDE-FGHJK')
  })

  it('leaves a wrong-length input alone rather than inventing a hyphen for it', () => {
    expect(normalizeCode('ABC')).toBe('ABC')
    expect(normalizeCode('')).toBe('')
  })
})
