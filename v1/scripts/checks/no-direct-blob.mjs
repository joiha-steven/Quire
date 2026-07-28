// Storage-portability gate: no src file may import a cloud blob SDK. The app stores
// binaries on the local filesystem only — the storage facade src/lib/blob.ts dispatches
// to src/lib/blob-local.ts (node:fs). This keeps a stray `@vercel/blob` import from
// creeping back in after the cloud driver was removed (would also break the self-host
// build, which has no such dependency).
import { readFileSync } from 'node:fs'
import { walk, isTs, report } from './_util.mjs'

const files = walk('src', isTs)
const violations = []

for (const file of files) {
  const raw = readFileSync(file, 'utf8')
  // Match a static or dynamic import of @vercel/blob or @vercel/blob/client.
  const m = raw.match(/['"](@vercel\/blob(?:\/client)?)['"]/)
  if (m) violations.push(`${file} — imports ${m[1]} (removed; binaries use the local fs driver)`)
}

console.log(`  scanned ${files.length} src files`)
process.exit(report('check:no-direct-blob', violations))
