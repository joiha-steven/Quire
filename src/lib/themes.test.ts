// Every shipped palette must be readable, not just pretty. `meta` is the secondary
// text colour (post meta lines, card excerpts, the footer) and renders at 14px, so
// WCAG AA's 4.5:1 applies to it; `link` is interactive text and gets the same bar.
//
// This exists because all six LIGHT palettes shipped between 2.91:1 and 3.60:1 and
// nobody noticed until the 2026-07-26 audit measured them. A palette is data, so a
// typo here is invisible in review — pin it.

import { describe, it, expect } from 'vitest'
import { THEME_PRESETS } from '@/lib/themes'

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => channel(c / 255))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(fg: string, bg: string): number {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((a, b) => b - a)
  return (hi + 0.05) / (lo + 0.05)
}

const AA = 4.5

describe('theme presets meet WCAG AA', () => {
  it('has presets to check', () => {
    expect(THEME_PRESETS.length).toBeGreaterThan(0)
  })

  for (const preset of THEME_PRESETS) {
    for (const mode of ['light', 'dark'] as const) {
      const p = preset.theme[mode]

      it(`${preset.id} ${mode}: meta text is readable on bg`, () => {
        expect(contrast(p.meta, p.bg)).toBeGreaterThanOrEqual(AA)
      })

      it(`${preset.id} ${mode}: link text is readable on bg`, () => {
        expect(contrast(p.link, p.bg)).toBeGreaterThanOrEqual(AA)
      })

      // Body + heading are larger, but they carry the article itself — hold them to
      // the same bar, which they already clear comfortably (10:1+).
      it(`${preset.id} ${mode}: body text is readable on bg`, () => {
        expect(contrast(p.text, p.bg)).toBeGreaterThanOrEqual(AA)
      })
    }
  }
})
