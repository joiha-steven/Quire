import { describe, it, expect, beforeEach, vi } from 'vitest'

// Consent step (account-takeover fix): because /api/mcp/register is public, an attacker
// can register their own client+redirect and phish the logged-in owner. So a NON-loopback
// authorize must NOT auto-issue a code — it must render a consent page, and the Approve
// POST must carry a CSRF token bound to the owner's SESSION (an attacker auto-submitting
// cross-site with the owner's cookies can't forge it). Loopback keeps auto-approve.

const authState = vi.hoisted(() => ({ authorized: true }))
// Fake "raw session JWT" returned by getToken({raw:true}); the CSRF token is HMAC'd over
// it, so a test computes the same token only by going through the real csrf helper.
const session = vi.hoisted(() => ({ raw: 'owner-session-jwt' as string | null }))

vi.mock('@/lib/mcp/auth', async (orig) => {
  const actual = (await orig()) as Record<string, unknown>
  // Keep the real issueCode (so a real code lands in the redirect) but force mcpEnabled.
  return { ...actual, mcpEnabled: () => Promise.resolve(true) }
})
vi.mock('@/lib/auth', () => ({ getAuthState: () => Promise.resolve({ email: 'o@x', authorized: authState.authorized }) }))
// isRedirectAllowed: registered host + loopback pass; everything else fails. (The real
// module hits the db; here we model its CONTRACT so the route test stays offline.)
vi.mock('@/lib/mcp/clients', async (orig) => {
  const actual = (await orig()) as { isLoopbackRedirect: (u: string) => boolean }
  return {
    isLoopbackRedirect: actual.isLoopbackRedirect,
    isRedirectAllowed: (_id: string, uri: string) =>
      Promise.resolve(actual.isLoopbackRedirect(uri) || uri === 'https://app.example.com/cb'),
  }
})
// next-auth/jwt getToken({raw:true}) → the owner's raw session JWT (or null when logged out).
vi.mock('next-auth/jwt', () => ({ getToken: () => Promise.resolve(session.raw) }))
// auth.ts (imported transitively) pulls settings/tokens — stub so import resolves offline.
vi.mock('@/lib/settings', () => ({ getSettings: () => Promise.resolve({ mcp: { enabled: true } }) }))
vi.mock('@/lib/mcp/tokens', () => ({ verifyTokenHash: () => Promise.resolve(null) }))
// consumeCodeJti is used by verifyCode only (not exercised here); stub for import safety.
vi.mock('@/lib/mcp/used-codes', () => ({ consumeCodeJti: () => Promise.resolve(true) }))

import { GET, POST } from '@/app/api/mcp/authorize/route'
import { csrfToken } from '@/lib/mcp/consent'

const CHALLENGE = 'x'.repeat(43)
const REGISTERED = 'https://app.example.com/cb'

function getReq(redirectUri: string): import('next/server').NextRequest {
  const u = new URL('https://blog.test/api/mcp/authorize')
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('code_challenge_method', 'S256')
  u.searchParams.set('code_challenge', CHALLENGE)
  u.searchParams.set('client_id', 'client-1')
  u.searchParams.set('redirect_uri', redirectUri)
  return new Request(u, { method: 'GET' }) as unknown as import('next/server').NextRequest
}

function postReq(fields: Record<string, string>): import('next/server').NextRequest {
  const body = new URLSearchParams(fields)
  return new Request('https://blog.test/api/mcp/authorize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  }) as unknown as import('next/server').NextRequest
}

beforeEach(() => {
  authState.authorized = true
  session.raw = 'owner-session-jwt'
})

describe('authorize consent step', () => {
  it('(a) non-loopback GET returns the consent page and issues NO code', async () => {
    const res = await GET(getReq(REGISTERED))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('text/html')
    const html = await res.text()
    expect(html).toContain('Authorize MCP connection')
    expect(html).toContain(REGISTERED) // the exact redirect_uri is shown to the owner
    // It is NOT a redirect, so no ?code= is handed to the (possibly attacker) host.
    expect(res.headers.get('Location')).toBeNull()
  })

  it('(b) approve POST WITHOUT a valid session CSRF token is rejected (no code)', async () => {
    const res = await POST(
      postReq({ client_id: 'client-1', redirect_uri: REGISTERED, code_challenge: CHALLENGE, state: '', csrf: 'forged' }),
    )
    expect(res.status).toBe(403)
    expect(res.headers.get('Location')).toBeNull()
  })

  it('approve POST WITH a valid session-bound CSRF token issues a code + 302', async () => {
    const params = { clientId: 'client-1', redirectUri: REGISTERED, challenge: CHALLENGE, state: 'st' }
    const csrf = await csrfToken(getReq(REGISTERED), params)
    expect(csrf).toBeTruthy()
    const res = await POST(
      postReq({ client_id: 'client-1', redirect_uri: REGISTERED, code_challenge: CHALLENGE, state: 'st', csrf: csrf! }),
    )
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('Location') ?? '')
    expect(loc.origin + loc.pathname).toBe(REGISTERED)
    expect(loc.searchParams.get('code')).toBeTruthy()
    expect(loc.searchParams.get('state')).toBe('st')
  })

  it("a CSRF token from a DIFFERENT session does not validate (session binding)", async () => {
    const params = { clientId: 'client-1', redirectUri: REGISTERED, challenge: CHALLENGE, state: '' }
    const attackerCsrf = await csrfToken(getReq(REGISTERED), params) // minted under owner session
    session.raw = 'a-different-session-jwt' // victim now has a different session
    const res = await POST(
      postReq({ client_id: 'client-1', redirect_uri: REGISTERED, code_challenge: CHALLENGE, state: '', csrf: attackerCsrf! }),
    )
    expect(res.status).toBe(403)
  })

  it('(c) loopback GET still auto-issues a code (no consent page)', async () => {
    const res = await GET(getReq('http://127.0.0.1:49152/callback'))
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.get('Location') ?? '')
    expect(loc.origin + loc.pathname).toBe('http://127.0.0.1:49152/callback')
    expect(loc.searchParams.get('code')).toBeTruthy()
  })
})
