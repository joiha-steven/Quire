// Every size on the reader's page comes from a type ROLE, so the owner's typography
// settings actually control the page.
//
// The rule was written at the top of `public.css.ts` from the beginning — "every size from
// a type role, no hardcoded px sizes" — and by the time anyone measured, the islands sheet
// carried nine literals, a related-post title had no size rule at all and fell back to the
// body size, and the comment thread was a role the settings could not reach. A rule that
// only exists in a comment is a rule that has already been broken.
//
// What counts as compliant:
//   * `var(--fs-<role>)`             the owner's setting for that role
//   * `inherit`                      deliberately taking the surrounding size
//   * a value in `em`                an ornament measured against its OWN context (a drop
//                                    cap, a dinkus), which stays right at every role size
//   * a listed exception             below, with a reason
//
// `login.css.ts` is NOT scanned. The sign-in page renders with an empty base sheet, so no
// `--fs-*` variable is defined on it and a role reference there would resolve to nothing.

import { readFileSync } from 'node:fs'

const SHEETS = ['src/web/public.css.ts', 'src/web/prose.css.ts', 'src/web/islands.css.ts']

/**
 * Literal sizes that are NOT text.
 *
 * Each of these sizes a GLYPH used as an icon — a multiplication sign for close, angle
 * brackets for previous and next. Their size is a hit target, decided with the padding
 * around them, and tying it to the reader's body-text setting would make the close button
 * grow when someone chose larger type.
 *
 * Adding to this list should feel like a decision. That is the point of it being a list
 * rather than a naming convention.
 */
const ALLOWED = new Map<string, string>([
  ['.lightbox-close', 'the × glyph, sized with its 2.5rem hit target'],
  ['.lightbox-prev,.lightbox-next', 'the ‹ › glyphs, sized with their 3rem hit targets'],
  ['.book-x', 'the × glyph that closes book mode, sized with its padding'],
  ['.book-arrow', 'the page-turn arrows in book mode, sized with their hit targets'],
  ['.search-close', 'the × glyph that closes the search overlay'],
])

type Finding = { file: string; line: number; selector: string; value: string }
const findings: Finding[] = []

/**
 * The selector a declaration belongs to.
 *
 * From the brace that opens this rule, back to whichever came last before it: the previous
 * rule's `}` or an enclosing `{` (an `@media` block). Comments in between are dropped, and
 * a selector written across two lines is joined, so a multi-line selector matches the
 * single-line form in ALLOWED.
 */
function selectorFor(body: string, at: number): string {
  const open = body.lastIndexOf('{', at)
  if (open === -1) return ''
  const start = Math.max(body.lastIndexOf('}', open), body.lastIndexOf('{', open - 1)) + 1
  return body.slice(start, open)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map((l) => l.trim()).filter(Boolean).join('')
    .trim()
}

for (const file of SHEETS) {
  const source = readFileSync(file, 'utf8')
  for (const match of source.matchAll(/font-size:\s*([^;}]+)/g)) {
    const value = match[1]!.trim()
    if (/^var\(--fs-[a-z0-9]+\)$/.test(value) || value === 'inherit' || /^[\d.]+em$/.test(value)) {
      continue
    }
    const selector = selectorFor(source, match.index)
    if (ALLOWED.has(selector)) continue
    findings.push({
      file, line: source.slice(0, match.index).split('\n').length, selector, value,
    })
  }
}

if (findings.length > 0) {
  console.error('✗ check:type-roles: a size on the reader\'s page that the owner cannot set')
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  ${f.selector || '(unknown selector)'}  font-size:${f.value}`)
  }
  console.error('  Use var(--fs-<role>), or add the selector to ALLOWED with a reason.')
  process.exit(1)
}

console.log(`✓ check:type-roles: ok (${SHEETS.length} sheet(s), ${ALLOWED.size} listed exception(s))`)
