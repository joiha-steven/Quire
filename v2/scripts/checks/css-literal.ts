// `public.css.ts` is ONE template literal, so a backtick anywhere inside it ends the
// string. It has happened three times, always in a comment, always around a CSS property
// name that reads naturally in backticks. Twice the server refused to boot; the third time
// the type checker caught it with two errors pointing at a line that looked fine.
//
// A comment saying "no backticks" was already in the file when it happened the third time,
// which is the argument for this being a check instead.

import { readFileSync } from 'node:fs'

const FILE = 'src/web/public.css.ts'
const source = readFileSync(FILE, 'utf8')

// Anchored on the declaration, NOT on the first backtick in the file: the module's own
// doc comment contains several, and the first version of this check reported them and
// failed on a clean file. A guard that cries wolf gets switched off.
const DECL = 'export const PUBLIC_CSS = '
const declAt = source.indexOf(DECL)
const open = declAt === -1 ? -1 : source.indexOf('`', declAt)
const close = source.lastIndexOf('`')
if (open === -1 || open === close) {
  console.error(`✗ check:css-literal: ${FILE} does not look like one template literal any more`)
  process.exit(1)
}

const body = source.slice(open + 1, close)
if (body.includes('`')) {
  const line = source.slice(0, open + 1 + body.indexOf('`')).split('\n').length
  console.error(`✗ check:css-literal: backtick inside the CSS literal, ${FILE}:${line}`)
  console.error('  It ends the string. Write the property name without backticks.')
  process.exit(1)
}

console.log('✓ check:css-literal: ok')
