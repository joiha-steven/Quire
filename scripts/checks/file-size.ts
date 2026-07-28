// Holds the 400-line rule from v2/CLAUDE.md. Prose rots, a red check does not.
//
// Locale dictionaries and type declarations are exempt: they are data and generated
// surface, and splitting them by line count would make them harder to read, not easier.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const MAX = 400
const ROOTS = ['src', 'scripts']

// `join` yields backslashes on Windows, which silently breaks every path pattern below.
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name).replaceAll('\\', '/')
    return statSync(p).isDirectory() ? walk(p) : [p]
  })

const exempt = (p: string) => p.includes('/locales/') || p.endsWith('.d.ts')

const files = ROOTS.flatMap(walk).filter((p) => /\.(ts|tsx)$/.test(p))
const violations = files
  .filter((p) => !exempt(p))
  .map((p) => ({ p, n: readFileSync(p, 'utf8').split('\n').length }))
  .filter(({ n }) => n > MAX)

const skipped = files.filter(exempt).length
console.log(`  scanned ${files.length - skipped} file(s) (limit ${MAX} lines); exempt: ${skipped}`)

if (violations.length === 0) {
  console.log('✓ check:filesize: ok')
} else {
  console.log(`✗ check:filesize: ${violations.length} violation(s)`)
  for (const { p, n } of violations) console.log(`  - ${p}: ${n} lines`)
  process.exit(1)
}
