// The owner's typography settings actually reaching the page.
//
// Every failure this pins was found by MEASURING a rendered page, not by reading the CSS:
// the sizes all looked like role references and the page still came out wrong.
import { describe, expect, it, afterAll } from 'bun:test'
import { freshDatabase, dropDatabase } from '@/test/db'
import { typographyToCss } from '@/content/settings'
import { DEFAULT_TYPOGRAPHY, TYPE_ROLES, getFontPreset } from '@/content/themes'
import { PUBLIC_CSS } from '@/web/public.css'
import { MONO_TRACKING } from '@/render/font-faces'

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

  // A related title used to have no size rule at all and fell back to the BODY size, so the
  // quietest block on the page was set as large as the writing. It is now one size
  // throughout, told apart by weight and colour.
  it('sets the whole related block at --fs-small, with no size of its own on the link', () => {
    expect(PUBLIC_CSS).toContain('.related{font-size:var(--fs-small)')
    expect(PUBLIC_CSS).toContain('.related h2{font-size:var(--fs-small)')
    const block = PUBLIC_CSS.slice(PUBLIC_CSS.indexOf('.related a{'))
    const rule = block.slice(0, block.indexOf('}'))
    expect(rule).toContain('font-weight:600')
    expect(rule).not.toContain('font-size')
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

describe('the mono-chrome tracking correction', () => {
  // Tracking INHERITS, so `body` alone covered the chrome until each rule started naming
  // its own --ls-<role> for the owner's sake. A rule that sets the property stops
  // inheriting, so the correction has to name it — and naming the wrong ones is the other
  // half of the same mistake.
  it('reaches the chrome surfaces that state their own tracking', () => {
    for (const selector of ['footer.site', 'p.tags', '.pager', 'header.site .tagline', '.related']) {
      expect(MONO_TRACKING).toContain(`html[data-chrome-font="jetbrains-mono"] ${selector}`)
      expect(MONO_TRACKING).toContain(`html[data-chrome-font="plex-mono"] ${selector}`)
    }
  })

  it('leaves the reading face alone', () => {
    // `figcaption` and `.footnotes` sit inside the article and render in --font-reading.
    // They were being given a MONO adjustment while painting in a book serif, because they
    // inherited it from body. Nothing set in the reading face may appear here.
    for (const selector of ['figcaption', '.footnotes', '.prose', '.reading-font', '.comment-body']) {
      expect(MONO_TRACKING).not.toContain(` ${selector}{`)
      expect(MONO_TRACKING).not.toContain(` ${selector},`)
    }
  })
})

describe('the author\'s own words are set in the reading face', () => {
  // The deck IS the excerpt: the same string a list card prints, where it has always
  // rendered in the reading font. Under the title it fell to --font-sans, so a blog with a
  // mono chrome opened every post with a book-serif headline and a terminal subtitle.
  it('gives the standfirst the reading family, as the card excerpt has', () => {
    expect(PUBLIC_CSS).toContain('.deck{margin:1rem 0 0;color:var(--c-meta);font-family:var(--font-reading)')
  })

  it('keeps the standfirst out of the mono-chrome correction', () => {
    expect(MONO_TRACKING).not.toContain(' .deck{')
    expect(MONO_TRACKING).not.toContain(' .deck,')
  })
})

describe('book mode is one number, and the owner asked for it not to move', () => {
  const css = typographyToCss(DEFAULT_TYPOGRAPHY)

  // THE FORMULA, fixed by the owner on 2026-07-29:
  //   book mode reading text = article reading text x 1.15
  //   every gap inside the article = the same x 1.15
  // Type and the space around it are one system. Enlarging the words and leaving the gaps
  // gives crowded reading, not bigger reading.
  it('emits every scale-dependent variable TWICE, on :root and on .book-overlay', () => {
    // The mechanism, not decoration. A var() inside a custom property is substituted where
    // that property is DECLARED, so `--fs-body` on :root resolves --type-scale against
    // :root — where it is undefined — and overriding the scale on a descendant changes
    // NOTHING. Book mode rendered at exactly the article's size from the port until this
    // was measured. Re-declaring the identical text on .book-overlay re-substitutes it
    // there, where the scale is 1.15.
    const root = /:root\{(.*?)\}/s.exec(css)?.[1] ?? ''
    const book = /\.book-overlay\{(.*?)\}/s.exec(css)?.[1] ?? ''
    expect(root).not.toBe('')
    expect(book).toBe(root)
    for (const role of TYPE_ROLES) {
      expect(book).toContain(`--fs-${role}:calc(`)
      expect(book).toContain('var(--type-scale, 1)')
    }
  })

  it('carries the SPACING unit through the same block, so gaps scale with the type', () => {
    // --sp is why the 15% reaches the gaps. It must live in this one block: a second
    // definition on :root anywhere else would win or lose by source order, and the overlay
    // would silently go back to unscaled spacing.
    expect(css).toContain('--sp:calc(1rem * var(--type-scale, 1))')
    expect((css.match(/--sp:calc/g) ?? []).length).toBe(2)
  })

  it('spends --sp on the article gaps that used to be frozen in rem', () => {
    // Measured 2026-07-29 in a real browser, book mode against the article: every ratio
    // 1.15 — body, leading, headings, paragraph gap, pre padding, blockquote indent,
    // figure margin, table cell padding. Before, every ratio was 1.000.
    for (const frozen of [
      '.prose li{margin:calc(var(--sp) * .25) 0}',
      'padding-left:var(--sp);color:var(--c-meta)}',
      '.prose pre{padding:var(--sp)',
      'padding:calc(var(--sp) * .4) calc(var(--sp) * .6)',
      'figure{margin:calc(var(--sp) * 2) 0}',
    ]) {
      expect(PUBLIC_CSS).toContain(frozen)
    }
  })

  it('sets the overlay in the reading face, tracking included', () => {
    // The running head IS the article's title, in the reading face. With no tracking of its
    // own it inherited the mono-chrome correction from body and set a book serif at
    // -0.05em: -0.7px a character, which is what "the letters are too close" was.
    expect(PUBLIC_CSS).toContain('font-family:var(--font-reading);letter-spacing:var(--ls-body)')
    expect(MONO_TRACKING).not.toContain('.book-title')
    expect(MONO_TRACKING).not.toContain('.book-count')
  })
})

describe('the IDE chrome is one switch, and off leaves no trace', () => {
  // The owner's brief: the furniture reads as source code while the reading column stays
  // analogue. The contrast IS the design, which also makes it a taste — so it is a switch,
  // and every rule behind it hangs off one attribute selector.
  it('gates every rule on the attribute, so nothing leaks when it is off', () => {
    const ide = PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome'))
    expect(ide.length).toBeGreaterThan(8)
    // A rule that mentions the attribute in a comment but selects without it would apply
    // unconditionally. Every declaration line must carry the selector.
    for (const line of ide) expect(line).toContain('html[data-ide-chrome=on]')
  })

  it('never touches the reading column', () => {
    // The half that must NOT look technical: the article body, its title, the card
    // excerpts and the comment bodies are the reader's own words.
    for (const line of PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome'))) {
      for (const reading of ['.prose', '.reading-font', '.deck', '.comment-body', '.fs-h1']) {
        expect(line).not.toContain(reading)
      }
    }
  })

  it('borrows only theme tokens for its two syntax roles', () => {
    // An editor distinguishes a comment from a literal. That is the whole palette here:
    // labels are --c-meta, counts and dates are --c-accent. No third colour, and no hex —
    // the same rule the rest of the public site follows.
    const ide = PUBLIC_CSS.split('\n').filter((l) => l.includes('data-ide-chrome')).join('\n')
    expect(ide).toContain('var(--c-accent)')
    expect(ide).toContain('var(--c-meta)')
    expect(ide).not.toMatch(/#[0-9a-fA-F]{3,8}/)
  })
})
