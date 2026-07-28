// The CSS sheets are each ONE template literal, so a backtick anywhere inside one ends the
// string. It happened three times in `public.css.ts`, always in a comment, always around a
// CSS property name that reads naturally in backticks. Twice the server refused to boot;
// the third time the type checker caught it with two errors pointing at a line that looked
// fine.
//
// A comment saying "no backticks" was already in the file when it happened the third time,
// which is the argument for this being a check instead.

import { readFileSync } from 'node:fs'

// Every sheet, by the declaration that opens it. This list went stale once already: the
// public sheet was split in two and renamed, the check kept passing against a constant that
// no longer existed, and the fourth backtick got through.
const SHEETS: Array<{ file: string; decl: string }> = [
  { file: 'src/web/public.css.ts', decl: 'const BASE_CSS = ' },
  { file: 'src/web/islands.css.ts', decl: 'export const ISLANDS_CSS = ' },
  { file: 'src/web/login.css.ts', decl: 'export const LOGIN_CSS = ' },
]

let failed = false

for (const { file, decl } of SHEETS) {
  const source = readFileSync(file, 'utf8')

  // Anchored on the declaration, NOT on the first backtick in the file: the module's own
  // doc comment contains several, and the first version of this check reported them and
  // failed on a clean file. A guard that cries wolf gets switched off.
  const declAt = source.indexOf(decl)
  const open = declAt === -1 ? -1 : source.indexOf('`', declAt)
  // The CLOSE is the terminator that follows the opener, not the last backtick in the
  // file: public.css.ts now ends with an interpolated export, so the last backtick sits
  // past the sheet and the scanned range came out empty.
  // Some sheets close with .trim() and some with a bare backtick opening a line.
  const ends = [source.indexOf('`.trim()', open + 1), source.indexOf('\n`', open + 1)]
    .filter((i) => i !== -1)
  const close = open === -1 || ends.length === 0 ? -1 : Math.min(...ends)
  if (open === -1 || close === -1) {
    console.error(`✗ check:css-literal: ${file} does not look like one template literal any more`)
    failed = true
    continue
  }

  const body = source.slice(open + 1, close)
  if (body.includes('`')) {
    const line = source.slice(0, open + 1 + body.indexOf('`')).split('\n').length
    console.error(`✗ check:css-literal: backtick inside the CSS literal, ${file}:${line}`)
    console.error('  It ends the string. Write the property name without backticks.')
    failed = true
  }
}

if (failed) process.exit(1)
console.log(`✓ check:css-literal: ok (${SHEETS.length} sheet(s))`)
