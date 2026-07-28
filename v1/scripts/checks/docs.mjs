// Guards the documentation layout, so the "four homes" rule is held by a red test
// rather than by prose nobody re-reads. See docs/README.md for the layout itself.
//
// Five rules, each one a mess this repo actually had:
//   1. No broken relative link between markdown files. Moving a doc used to leave
//      dangling links in five other files and nothing noticed.
//   2. Every ADR appears in the decisions index, and the index cites no missing ADR.
//      An ADR nobody can find is worse than no ADR.
//   3. CLAUDE.md stays under its cap. It loads every turn, so it is a router, not a
//      library; it was 275 lines of restated rules before this check existed.
//   4. Nothing in docs/ carries a date in its filename. A dated file is a snapshot and
//      belongs in state/reports/ or state/audits/, which are write-only.
//   5. No markdown file over 700 lines, CHANGELOG excepted (append-only by design).
import { readFileSync, existsSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { walk, lineCount, report } from './_util.mjs'

const ROOT = process.cwd()
const CLAUDE_MD_MAX = 170
const FILE_MAX = 700

const isMd = (p) => p.endsWith('.md')
// `v2/golden/corpus/` holds markdown FIXTURES, not documents. Their links point at
// deliberately fake images and dangerous schemes, because that is exactly what they test.
const skip = (p) =>
  /(^|[\\/])(node_modules|\.next|\.git)[\\/]/.test(p) ||
  /(^|[\\/])v2[\\/]golden[\\/]corpus[\\/]/.test(p)

// `state/audits/` and `state/reports/` are WRITE-ONLY: a snapshot records what was true
// on its date and is never retro-edited, so its links are historical and are allowed to
// rot. Checking them would force exactly the retro-editing the rule forbids.
const frozen = (p) => /^state\/(audits|reports)\//.test(p)

const files = ['.', 'docs', 'state', 'v2', 'go', 'scripts', '.github']
  .filter((d) => existsSync(d))
  .flatMap((d) => (statSync(d).isDirectory() ? walk(d, isMd) : []))
  .filter((p) => !skip(p))
  .map((p) => p.replace(/^\.\//, ''))

const uniq = [...new Set(files)].sort()
const violations = []

// 1. Relative links resolve. Absolute URLs, anchors and mailto are not our problem.
for (const file of uniq.filter((p) => !frozen(p))) {
  const src = readFileSync(file, 'utf8')
  for (const [, target] of src.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
    if (/^([a-z][a-z0-9+.-]*:|#|<)/i.test(target)) continue
    const [path] = target.split('#')
    if (!path) continue // pure anchor
    const abs = resolve(dirname(join(ROOT, file)), path)
    if (!existsSync(abs)) violations.push(`${file}: broken link -> ${target}`)
  }
}

// 2. The decisions index and the ADR files agree, in both directions.
const ADR_DIR = 'docs/decisions'
if (existsSync(ADR_DIR)) {
  const index = join(ADR_DIR, 'README.md')
  const adrs = uniq.filter((p) => p.startsWith(`${ADR_DIR}/`) && !p.endsWith('README.md'))
  if (!existsSync(index)) {
    violations.push(`${ADR_DIR}/README.md is missing (the still-in-force index)`)
  } else {
    const body = readFileSync(index, 'utf8')
    for (const adr of adrs) {
      const name = adr.slice(ADR_DIR.length + 1)
      if (!body.includes(name)) violations.push(`${index}: does not list ${name}`)
    }
    for (const [, cited] of body.matchAll(/\]\((\d{4}-[^)#]+\.md)\)/g)) {
      if (!existsSync(join(ADR_DIR, cited))) violations.push(`${index}: cites missing ${cited}`)
    }
  }
}

// 3. CLAUDE.md is a router, not a library.
for (const file of uniq.filter((p) => p.endsWith('CLAUDE.md'))) {
  const n = lineCount(readFileSync(file, 'utf8'))
  if (n > CLAUDE_MD_MAX) {
    violations.push(`${file}: ${n} lines, cap ${CLAUDE_MD_MAX}. Move detail into docs/ and link to it`)
  }
}

// 4. A dated filename is a snapshot; docs/ holds current truth only.
for (const file of uniq.filter((p) => p.startsWith('docs/'))) {
  if (/\d{4}-\d{2}(-\d{2})?/.test(file.split('/').pop())) {
    violations.push(`${file}: dated filename in docs/. Snapshots live in state/reports/ or state/audits/`)
  }
}

// 5. Size cap, so a doc gets split before it becomes unreadable.
for (const file of uniq) {
  if (file.endsWith('CHANGELOG.md')) continue
  const n = lineCount(readFileSync(file, 'utf8'))
  if (n > FILE_MAX) violations.push(`${file}: ${n} lines, cap ${FILE_MAX}. Split it`)
}

console.log(`  scanned ${uniq.length} markdown file(s)`)
process.exit(report('check:docs', violations))
