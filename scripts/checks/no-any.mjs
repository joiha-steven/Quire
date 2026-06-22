// Code-hygiene gate (audit §4): no `any` types, no stray console.log, no
// TODO/FIXME, no @ts-ignore in src. `any`/console.log are matched on code with
// comments + strings stripped (so a comment mentioning "any" is fine); the marker
// comments are matched on raw text.
//
// Escape hatch for a SANCTIONED console.log: put `// check:allow-console` on the
// same line. It stays greppable + auditable; every unmarked console.log fails.
import { readFileSync } from 'node:fs'
import { walk, isTs, stripCommentsAndStrings, report } from './_util.mjs'

// `any` used as a type (not the substring of another word).
const ANY_PATTERNS = [
  /\bas\s+any\b/,
  /:\s*any\b/,
  /<\s*any\s*[,>]/,
  /,\s*any\s*[,>]/,
  /\bany\s*\[\]/,
  /\|\s*any\b/,
  /\bany\s*\|/,
]

const files = walk('src', isTs)
const violations = []

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  const code = stripCommentsAndStrings(raw)
  const rawLines = raw.split('\n')
  const codeLines = code.split('\n')
  for (let i = 0; i < codeLines.length; i++) {
    const codeLine = codeLines[i]
    const rawLine = rawLines[i] ?? ''
    const at = `${file}:${i + 1}`
    if (ANY_PATTERNS.some((re) => re.test(codeLine))) violations.push(`${at} — 'any' type`)
    if (/\bconsole\.log\s*\(/.test(codeLine) && !rawLine.includes('check:allow-console'))
      violations.push(`${at} — console.log`)
    if (/\b(TODO|FIXME)\b/.test(rawLine)) violations.push(`${at} — ${rawLine.match(/\b(TODO|FIXME)\b/)[1]}`)
    if (/@ts-ignore\b/.test(rawLine)) violations.push(`${at} — @ts-ignore`)
  }
}

console.log(`  scanned ${files.length} src files`)
process.exit(report('check:no-any', violations))
