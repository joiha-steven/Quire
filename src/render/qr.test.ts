// Verifying a QR encoder is awkward: asking the library to read back what it just wrote
// proves nothing, and there is no scanner here. So these assert STRUCTURE that the QR
// specification fixes independently of any implementation — chiefly the three finder
// patterns, which are the first thing a scanner looks for and the first thing a broken
// encoder gets wrong.
import { describe, it, expect } from 'bun:test'
import { qrSvg } from './qr'
import { otpauthUri } from '@/auth/totp'

const MARGIN = 4

/** Re-read the emitted path back into a grid, so these test the SVG, not the library. */
function grid(svg: string): { dark: Set<string>; size: number } {
  const size = Number(svg.match(/viewBox="0 0 (\d+)/)![1])
  const d = svg.match(/<path d="([^"]*)"/)![1]
  const dark = new Set<string>()
  for (const m of d.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) dark.add(`${m[1]},${m[2]}`)
  return { dark, size }
}

const isDark = (g: ReturnType<typeof grid>, col: number, row: number) => g.dark.has(`${col},${row}`)

/**
 * A finder pattern: a 7x7 block that is a filled 3x3 core, a light ring, and a dark
 * border. Present at three corners of every QR code ever made, at any version.
 */
function hasFinderAt(g: ReturnType<typeof grid>, ox: number, oy: number): boolean {
  const EXPECTED = [
    '#######',
    '#     #',
    '# ### #',
    '# ### #',
    '# ### #',
    '#     #',
    '#######',
  ]
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 7; col++) {
      if (isDark(g, ox + col, oy + row) !== (EXPECTED[row][col] === '#')) return false
    }
  }
  return true
}

describe('qrSvg', () => {
  const uri = otpauthUri('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'hung')
  const svg = qrSvg(uri)
  const g = grid(svg)

  it('emits one svg with a viewBox and no fixed size, so CSS decides', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ')).toBe(true)
    // The OPENING TAG only. A bare `not.toContain('width=')` matches the background
    // <rect>, which does carry one, and fails on correct output.
    expect(svg.slice(0, svg.indexOf('>'))).not.toContain('width=')
    expect(svg.endsWith('</svg>')).toBe(true)
  })

  // A QR version is 21, 25, 29 ... modules, i.e. 17 + 4v. With the 4-module quiet zone on
  // each side, a valid size is that plus 8.
  it('is a legal module count for some QR version', () => {
    const modules = g.size - MARGIN * 2
    expect((modules - 17) % 4).toBe(0)
    expect(modules).toBeGreaterThanOrEqual(21)
  })

  it('has the three finder patterns, inset by the quiet zone', () => {
    const last = g.size - MARGIN - 7
    expect(hasFinderAt(g, MARGIN, MARGIN)).toBe(true)          // top left
    expect(hasFinderAt(g, last, MARGIN)).toBe(true)            // top right
    expect(hasFinderAt(g, MARGIN, last)).toBe(true)            // bottom left
  })

  // The fourth corner is deliberately EMPTY. It is how a scanner tells which way up the
  // code is, so a "finder" there would be a broken encoder, not a nicer symmetry.
  it('leaves the bottom-right corner without a finder', () => {
    const last = g.size - MARGIN - 7
    expect(hasFinderAt(g, last, last)).toBe(false)
  })

  it('keeps the quiet zone clear on every side', () => {
    for (let i = 0; i < g.size; i++) {
      for (let m = 0; m < MARGIN; m++) {
        expect(isDark(g, i, m)).toBe(false)
        expect(isDark(g, i, g.size - 1 - m)).toBe(false)
        expect(isDark(g, m, i)).toBe(false)
        expect(isDark(g, g.size - 1 - m, i)).toBe(false)
      }
    }
  })

  it('encodes different data differently', () => {
    expect(qrSvg('one')).not.toBe(qrSvg('two'))
  })

  // Fixed black on white, NOT theme tokens. A dark theme rendering this inverted produces
  // a code many scanners refuse, so this is the one place a hardcoded colour is right.
  it('is black on white regardless of theme', () => {
    expect(svg).toContain('fill="#fff"')
    expect(svg).toContain('fill="#000"')
    expect(svg).not.toContain('var(--')
  })
})
