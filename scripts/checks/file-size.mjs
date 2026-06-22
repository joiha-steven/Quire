// Convention: max 400 lines per source file (keeps modules thin + reviewable).
// Scans every .ts/.tsx under src (incl. tests). Prints offenders longest-first.
//
// EXEMPT: pure type-declaration files (`*.d.ts`, `**/types.ts`). The 400-line cap
// targets LOGIC files (code to reason about); a type manifest is one cohesive unit
// with no logic and grows by design as UI strings are added. Exempting by KIND is
// cleaner + zero-maintenance vs. a per-line marker.
import { readFileSync } from 'node:fs'
import { walk, isTs, lineCount, report } from './_util.mjs'

const LIMIT = 400
const isTypeDecl = (p) => /\.d\.ts$/.test(p) || /(?:^|\/)types\.ts$/.test(p)

const all = walk('src', isTs)
const files = all.filter((p) => !isTypeDecl(p))
const exempt = all.filter(isTypeDecl)
const violations = []
for (const file of files) {
  const n = lineCount(readFileSync(file, 'utf8'))
  if (n > LIMIT) violations.push({ file, n })
}
violations.sort((a, b) => b.n - a.n)

console.log(`  scanned ${files.length} src files (limit ${LIMIT} lines); ` +
  `exempt: ${exempt.length} type declaration(s) [${exempt.join(', ')}]`)
process.exit(
  report(
    'check:filesize',
    violations.map((v) => `${v.file} — ${v.n} lines (over by ${v.n - LIMIT})`),
  ),
)
