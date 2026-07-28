// The owner's typography settings actually reaching the page.
//
// Every failure this pins was found by MEASURING a rendered page, not by reading the CSS:
// the sizes all looked like role references and the page still came out wrong.
import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { typographyToCss } from '@/content/settings'
import { DEFAULT_TYPOGRAPHY, TYPE_ROLES, getFontPreset } from '@/content/themes'
import { PUBLIC_CSS } from '@/web/public.css'

const DIR = './.tmp-test-typography'
freshDatabase(DIR)
afterAll(() => dropDatabase(DIR))

describe('typographyToCss', () => {
  it('emits all three variables for every role', () => {
    const css = typographyToCss(DEFAULT_TYPOGRAPHY)
    for (const role of TYPE_ROLES) {
      expect(css).toContain(`--fs-${role}:`)
      expect(css).toContain(`--lh-${role}:`)
      expect(css).toContain(`--ls-${role}:`)
    }
  })

  // The multiplier belongs INSIDE the variable. Spelled at the call sites instead, a rule
  // either had it or did not, and book mode enlarged the prose while leaving figcaptions,
  // tags and the comment thread at their unscaled size.
  it('bakes --type-scale into every size, so a subtree scales all of them', () => {
    const css = typographyToCss(DEFAULT_TYPOGRAPHY)
    for (const role of TYPE_ROLES) {
      expect(css).toContain(`--fs-${role}:calc(`)
      expect(css).toContain('var(--type-scale, 1)')
    }
    // Only the SIZE scales. Line height is a ratio and letter-spacing is in em, so both
    // already follow the size; multiplying them again would compound.
    expect(css).not.toMatch(/--lh-[a-z0-9]+:calc/)
    expect(css).not.toMatch(/--ls-[a-z0-9]+:calc/)
  })
})

describe('the public sheet', () => {
  // The rule is enforced by `bun run check:type`. This is the same rule asserted against the
  // ASSEMBLED sheet, which is what a reader actually receives.
  it('sizes text only from role variables', () => {
    const literals = [...PUBLIC_CSS.matchAll(/font-size:\s*([^;}]+)/g)]
      .map((m) => m[1]!.trim())
      .filter((v) => !/^var\(--fs-[a-z0-9]+\)$/.test(v) && v !== 'inherit' && !/^[\d.]+em$/.test(v))
    // What is left is the icon glyphs listed in scripts/checks/type-roles.ts.
    expect(literals.every((v) => /^[\d.]+rem$/.test(v))).toBe(true)
    expect(literals.length).toBeLessThanOrEqual(5)
  })

  // Found by measuring: an h2 carries a UA default of 1.5em, so a section heading left to
  // inherit came out LARGER than the items under it.
  it('states a size on every heading it styles, rather than inheriting a UA default', () => {
    for (const selector of ['.related h2', '#comments h2']) {
      const rule = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf(selector))
      expect(rule.slice(0, rule.indexOf('}'))).toContain('font-size:var(--fs-')
    }
  })

  // The end-of-article furniture descends. A related title used to have no size rule at
  // all and fell back to the BODY size, so the quietest block on the page was set as large
  // as the writing.
  it('sets the related list below the body, and its label below that', () => {
    const block = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf('.related{'))
    expect(block.slice(0, block.indexOf('.related p'))).toContain('.related a{font-size:var(--fs-h5)')
    expect(PUBLIC_CSS).toContain('.related{font-size:var(--fs-small)')
  })

  // A comment is somebody's words. The frozen tree set it in the reading face and the port
  // dropped it, which left the whole thread in the chrome font.
  it('sets a comment body in the reading face', () => {
    const rule = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf('.comment-body{'))
    expect(rule.slice(0, rule.indexOf('}'))).toContain('font-family:var(--font-reading)')
  })
})

describe('the font presets', () => {
  it('give every role a complete style', () => {
    for (const preset of ['inter', 'source-sans', 'literata', 'source-serif']) {
      const { roles } = getFontPreset(preset).typography
      for (const role of TYPE_ROLES) {
        expect(roles[role].size).toBeGreaterThan(0)
        expect(roles[role].line).toBeGreaterThan(1)
      }
    }
  })

  // The furniture must stay below the reading size in every preset, or the dates and the
  // footer start competing with the writing.
  it('keeps small and caption under body, and caption under small', () => {
    for (const preset of ['inter', 'source-sans', 'literata', 'source-serif']) {
      const { roles } = getFontPreset(preset).typography
      expect(roles.small.size).toBeLessThan(roles.body.size)
      expect(roles.caption.size).toBeLessThan(roles.small.size)
      // And not SO far under it that secondary text becomes fine print: 14px against an
      // 18px body was the complaint that started this.
      expect(roles.small.size / roles.body.size).toBeGreaterThan(0.8)
    }
  })

  // The serifs carry finer strokes, so their secondary text is set larger than the sans's.
  it('sets the serif presets larger at small sizes than the sans presets', () => {
    const small = (id: string) => getFontPreset(id).typography.roles.small.size
    expect(small('literata')).toBeGreaterThan(small('inter'))
    expect(small('source-serif')).toBeGreaterThan(small('source-sans'))
  })
})
