// Implicit invariant (asymmetric cache-bust policy):
//   - MCP token CRUD routes must NEVER bust the public 'db' tag. They are
//     force-no-store, so an admin read is live; calling revalidateTag('db') here
//     would OVER-PURGE every public page on a token mint/delete. The regression
//     risk lives at the CALL SITE (the token route), not in revalidate.ts — so a
//     unit test on revalidate.ts can't catch it. This is the precise negative check.
//   - SYMMETRIC (coarse tripwire): backup-state.ts must STILL wire the DB bust
//     (its writes are out-of-band and DO need revalidateTag(DB_TAG)). This only
//     catches wholesale removal — per-write-function coverage is review-enforced
//     (see CLAUDE.md invariant #2).
import { readFileSync } from 'node:fs'
import { walk, stripComments, report } from './_util.mjs'

const BUST_DB = /revalidateTag\s*\(\s*(?:DB_TAG|['"]db['"])/

const violations = []

// 1. Negative: no token route may bust 'db'.
const tokenRoutes = walk('src/app/api/mcp/tokens', (p) => p.endsWith('route.ts'))
for (const file of tokenRoutes) {
  const code = stripComments(readFileSync(file, 'utf8'))
  if (BUST_DB.test(code)) {
    violations.push(`${file} — token route MUST NOT revalidateTag('db') (over-purges public; relies on force-no-store)`)
  }
}

// 2. Positive tripwire: backup-state.ts must still bust 'db' somewhere.
const BACKUP_STATE = 'src/lib/backup-state.ts'
if (!BUST_DB.test(stripComments(readFileSync(BACKUP_STATE, 'utf8')))) {
  violations.push(`${BACKUP_STATE} — out-of-band writes lost their revalidateTag(DB_TAG) bust wiring`)
}

console.log(`  scanned ${tokenRoutes.length} token route(s) + backup-state.ts`)
process.exit(report('check:token-bust', violations))
