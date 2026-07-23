// Edge owner-guard — defense-in-depth on top of each route's `requireOwner()`.
// Reads the NextAuth JWT (no DB) and lets only the configured owner past. A new
// admin page or owner-only API route is protected even if it forgets the in-route
// check. Public / self-authed endpoints are allow-listed so they keep working
// without an owner session (analytics beacon, search, cron, the MCP transport).

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthorized } from '@/lib/auth-shared'
import { normalizePath } from '@/lib/redirect-path'

// User-managed redirects (301/302). Resolved HERE, not in a page: a page-level
// redirect() under a route with a loading.tsx is downgraded by Next to a 200 meta-
// refresh (see the page/1 note below), so a real HTTP redirect must come from the
// edge, before any render. Self-hosted Next runs middleware in ONE long-lived Node
// process, so this module-level map persists across requests — a Map.get on the hot
// path, refreshed from PostgREST at most once per TTL. Edge-safe: a plain fetch (NOT
// the node-only supabase-js `db()` client). Fail-open — a lookup error never blocks.
type Target = { destination: string; permanent: boolean }
const REDIRECT_TTL_MS = 60_000
let redirectCache: { at: number; map: Map<string, Target> } | null = null

async function redirectMap(): Promise<Map<string, Target>> {
  if (redirectCache && Date.now() - redirectCache.at < REDIRECT_TTL_MS) return redirectCache.map
  const base = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!base || !key) return redirectCache?.map ?? new Map()
  const prefix = process.env.POSTGREST_DIRECT === '1' ? '' : '/rest/v1'
  try {
    const res = await fetch(`${base}${prefix}/redirects?select=source,destination,permanent`, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    if (!res.ok) return redirectCache?.map ?? new Map()
    const rows = (await res.json()) as Array<{ source: string; destination: string; permanent: boolean }>
    const map = new Map<string, Target>()
    for (const r of rows) map.set(r.source, { destination: r.destination, permanent: r.permanent })
    redirectCache = { at: Date.now(), map }
    return map
  } catch {
    return redirectCache?.map ?? new Map()
  }
}

// Paths that handle their own auth (bearer token, CRON_SECRET, PKCE) or are public
// reads, so they must NOT require an owner session. Note: /api/mcp covers the MCP
// transport + OAuth flow, but /api/mcp/tokens is owner-only admin CRUD.
function isPublicApi(pathname: string): boolean {
  if (pathname.startsWith('/api/mcp/tokens')) return false
  return (
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/track') ||
    pathname.startsWith('/api/search') ||
    // Newsletter: public sign-up + the confirm/unsubscribe links clicked from email.
    pathname.startsWith('/api/subscribe') ||
    pathname.startsWith('/api/newsletter') ||
    // Public read: raw Markdown of a post/page (Accept: text/markdown negotiation).
    pathname.startsWith('/api/md/') ||
    // ONLY the exact collection endpoint (GET list + POST create) is public; the
    // admin DELETE at /api/comments/[id] stays owner-gated by the middleware net.
    pathname === '/api/comments' ||
    pathname.startsWith('/api/mcp')
  )
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Page 1 IS the base ('/', '/category/x', '/tag/x') — 308 to it. This MUST live in
  // middleware: a page-level redirect() runs after `loading.tsx` has streamed, so Next
  // downgrades it to a client meta-refresh (200), not a real HTTP redirect. Middleware
  // runs before any render, so the crawler gets a clean 308.
  const pageOne = pathname.match(/^(\/(?:category|tag)\/[^/]+)?\/page\/1$/)
  if (pageOne) return NextResponse.redirect(new URL(pageOne[1] ?? '/', req.url), 308)

  // The owner guard + redirects only concern PUBLIC vs /admin+/api. Public paths get a
  // redirect-table lookup (real 301/302), then pass through — no JWT read.
  if (!pathname.startsWith('/admin') && !pathname.startsWith('/api')) {
    const hit = (await redirectMap()).get(normalizePath(pathname))
    if (hit) return NextResponse.redirect(new URL(hit.destination, req.url), hit.permanent ? 301 : 302)
    return
  }

  // Read + verify the NextAuth JWT directly (no provider config, no DB) so this
  // stays edge-safe even though the full auth config reads keys from Postgres.
  const token = await getToken({ req, secret: process.env.AUTH_SECRET, secureCookie: req.nextUrl.protocol === 'https:' })
  const email = typeof token?.email === 'string' ? token.email : null
  if (isAuthorized(email)) return // owner → proceed

  // Admin UI → bounce to sign-in (mirrors the /admin layout guard).
  if (pathname.startsWith('/admin')) {
    const url = new URL('/api/auth/signin', req.nextUrl.origin)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }
  // Owner-only API → 401, unless it authenticates itself (allow-listed above).
  if (pathname.startsWith('/api') && !isPublicApi(pathname)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
}

// Run on every path so redirects resolve anywhere, EXCEPT Next internals + uploaded
// binaries (the heavy asset traffic that never needs a guard or a redirect).
export const config = {
  matcher: ['/((?!_next/|uploads/).*)'],
}
