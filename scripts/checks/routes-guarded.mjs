// Invariant 4: every write/delete + owner-only API route calls requireOwner().
// The ONLY routes allowed to skip it are the intentionally-public / self-authed
// ones — and that set is the SINGLE source of truth in src/middleware.ts
// (isPublicApi). This check mirrors that allowlist; if you add a public route,
// add it there (and the middleware) — not by deleting the guard.
//
// NOTE: this is a static string-presence check (same semantics as the manual
// `grep -L requireOwner`), not dataflow — a route that imports requireOwner for
// another purpose still passes. Pair it with the middleware net + code review.
import { readFileSync } from 'node:fs'
import { walk, report } from './_util.mjs'

const API_DIR = 'src/app/api'

// Mirror of middleware.ts isPublicApi(). Keep in sync with that file.
function isPublicApi(pathname) {
  if (pathname.startsWith('/api/mcp/tokens')) return false
  return (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/track') ||
    pathname.startsWith('/api/search') ||
    pathname === '/api/comments' ||
    pathname.startsWith('/api/mcp')
  )
}

// src/app/api/posts/[slug]/route.ts -> /api/posts/[slug]
const toApiPath = (file) => '/' + file.replace(/^src\/app\//, '').replace(/\/route\.ts$/, '')

const routes = walk(API_DIR, (p) => p.endsWith('route.ts'))
const violations = []
let guarded = 0
const exempt = []

for (const file of routes) {
  const apiPath = toApiPath(file)
  const hasGuard = /\brequireOwner\s*\(/.test(readFileSync(file, 'utf8'))
  if (isPublicApi(apiPath)) {
    exempt.push(apiPath)
    continue
  }
  if (hasGuard) guarded++
  else violations.push(`${apiPath} (${file}) — owner-only route without requireOwner()`)
}

console.log(
  `  scanned ${routes.length} routes: ${guarded} owner-gated, ${exempt.length} public-exempt ` +
    `(${exempt.sort().join(', ')})`,
)
process.exit(report('check:routes', violations))
