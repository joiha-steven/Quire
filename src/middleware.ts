// Edge owner-guard — defense-in-depth on top of each route's `requireOwner()`.
// Reads the NextAuth JWT (no DB) and lets only the configured owner past. A new
// admin page or owner-only API route is protected even if it forgets the in-route
// check. Public / self-authed endpoints are allow-listed so they keep working
// without an owner session (analytics beacon, search, cron, the MCP transport).

import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { isAuthorized } from '@/lib/auth-shared'

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
    // ONLY the exact collection endpoint (GET list + POST create) is public; the
    // admin DELETE at /api/comments/[id] stays owner-gated by the middleware net.
    pathname === '/api/comments' ||
    pathname.startsWith('/api/mcp')
  )
}

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
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

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
}
