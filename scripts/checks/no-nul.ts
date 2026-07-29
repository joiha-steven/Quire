// No literal NUL byte in a source file.
//
// `highlight.ts` built its cache key with `${lang}\0${theme}\0${code}` — except the three
// separators were typed as ACTUAL NUL bytes rather than the escape. Nothing broke at
// runtime and the file worked perfectly, which is exactly why it survived: the damage was
// to the tools. `grep` reported the file as binary and refused to search it, `git diff`
// showed "Bin 3642 -> 2947 bytes" instead of a diff, and an exact-match edit against text
// copied out of the file silently failed to apply.
//
// A source file the tools will not read is a source file nobody reviews or edits with
// confidence. Write the escape.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['src', 'scripts']
const EXTENSIONS = ['.ts', '.tsx', '.sql', '.css', '.json']
const SKIP = new Set(['dist', 'node_modules', 'fonts'])

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return SKIP.has(entry.name) ? [] : walk(path)
    return EXTENSIONS.some((e) => entry.name.endsWith(e)) ? [path] : []
  })
}

const findings: { file: string; count: number }[] = []
let scanned = 0
for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned += 1
    const count = readFileSync(file).filter((b) => b === 0).length
    if (count > 0) findings.push({ file, count })
  }
}

if (findings.length > 0) {
  console.error('✗ check:no-nul: a literal NUL byte in a source file')
  for (const f of findings) console.error(`  ${f.file}  (${f.count})`)
  console.error('  Write the escape instead. grep, git diff and exact-match edits all')
  console.error('  treat a file containing one as binary and stop being useful on it.')
  process.exit(1)
}

console.log(`✓ check:no-nul: ok (${scanned} file(s))`)
