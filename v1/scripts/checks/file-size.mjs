// Convention: max 400 lines per source file (keeps modules thin + reviewable).
// Scans every .ts/.tsx under src (incl. tests). Prints offenders longest-first.
//
// EXEMPT (by KIND — cleaner + zero-maintenance vs. a per-line marker):
//  - pure type-declaration files (`*.d.ts`, `**/types.ts`);
//  - i18n dictionaries under `src/locales/` (the per-language string maps + their
//    `types.ts`). The 400-line cap targets LOGIC files (code to reason about); these
//    are cohesive DATA manifests with no logic that grow by design as UI strings are
//    added. The actual i18n LOGIC (`t()`, formatters) lives in `src/lib/*-i18n.ts`,
//    which is NOT exempt.
import { readFileSync } from 'node:fs'
import { walk, isTs, lineCount, report } from './_util.mjs'

const LIMIT = 400
const isExempt = (p) => /\.d\.ts$/.test(p) || /(?:^|\/)types\.ts$/.test(p) || /(?:^|\/)locales\//.test(p)

const all = walk('src', isTs)
const files = all.filter((p) => !isExempt(p))
const exempt = all.filter(isExempt)
const violations = []
for (const file of files) {
  const n = lineCount(readFileSync(file, 'utf8'))
  if (n > LIMIT) violations.push({ file, n })
}
violations.sort((a, b) => b.n - a.n)

console.log(`  scanned ${files.length} src files (limit ${LIMIT} lines); ` +
  `exempt: ${exempt.length} type-decl + i18n-dictionary file(s)`)
process.exit(
  report(
    'check:filesize',
    violations.map((v) => `${v.file} — ${v.n} lines (over by ${v.n - LIMIT})`),
  ),
)
