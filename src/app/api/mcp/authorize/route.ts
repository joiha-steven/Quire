// OAuth authorization endpoint (thin layer). The owner is the only identity: if not
// signed in as the owner we bounce through NextAuth and come back here. A LOOPBACK
// redirect (the user's own machine, low risk) auto-approves on GET. A NON-loopback
// redirect requires an explicit consent click — because /api/mcp/register is public, an
// attacker could register their own client+redirect and phish the owner, so the owner
// must SEE and Approve the exact client_id + redirect_uri. The Approve POST carries a
// CSRF token bound to the owner's session (see consent.ts), so a forged cross-site
// auto-submit can't issue a code. Only after Approve do we mint the PKCE-bound code.

import type { NextRequest } from 'next/server'
import { getAuthState } from '@/lib/auth'
import { issueCode, mcpEnabled } from '@/lib/mcp/auth'
import { isRedirectAllowed, isLoopbackRedirect } from '@/lib/mcp/clients'
import { csrfToken, verifyCsrf, consentPage, type OAuthParams } from '@/lib/mcp/consent'

export const dynamic = 'force-dynamic'

type Parsed = { params: OAuthParams; method: string | null; responseType: string | null }

// Pull the OAuth params from a query string (GET) or form body (POST approve).
function parse(src: URLSearchParams): Parsed {
  return {
    params: {
      clientId: src.get('client_id') ?? '',
      redirectUri: src.get('redirect_uri') ?? '',
      challenge: src.get('code_challenge') ?? '',
      state: src.get('state') ?? '',
    },
    method: src.get('code_challenge_method'),
    responseType: src.get('response_type'),
  }
}

// Shared validity gate (both verbs): well-formed PKCE request + an allowed redirect_uri.
// Returns an error Response (never redirected to the unvalidated uri) or null when OK.
async function validate(p: OAuthParams, method: string | null, responseType: string | null): Promise<Response | null> {
  if (responseType !== 'code' || !p.redirectUri || !p.challenge || method !== 'S256') {
    return new Response('invalid_request (need response_type=code, redirect_uri, S256 PKCE)', { status: 400 })
  }
  try {
    new URL(p.redirectUri)
  } catch {
    return new Response('invalid redirect_uri', { status: 400 })
  }
  if (!(await isRedirectAllowed(p.clientId, p.redirectUri))) {
    return new Response('invalid_request: redirect_uri not registered for this client', { status: 400 })
  }
  return null
}

// Issue a code and 302 it to the (already validated) redirect_uri, carrying state.
function issueAndRedirect(p: OAuthParams): Response {
  const dest = new URL(p.redirectUri)
  dest.searchParams.set('code', issueCode(p.redirectUri, p.challenge))
  if (p.state) dest.searchParams.set('state', p.state)
  return Response.redirect(dest.toString(), 302)
}

export async function GET(req: NextRequest): Promise<Response> {
  if (!(await mcpEnabled())) return new Response('MCP is disabled', { status: 503 })

  const url = new URL(req.url)
  const { params, method, responseType } = parse(url.searchParams)
  const bad = await validate(params, method, responseType)
  if (bad) return bad

  // Only the configured owner may authorize. Otherwise sign in, then return here.
  const { authorized } = await getAuthState()
  if (!authorized) {
    const callback = encodeURIComponent(url.pathname + url.search)
    return Response.redirect(`${url.origin}/api/auth/signin?callbackUrl=${callback}`, 302)
  }

  // Loopback → the user's own machine; auto-approve as before. Non-loopback → show the
  // consent page (issues NO code) so the owner explicitly approves the exact host.
  if (isLoopbackRedirect(params.redirectUri)) return issueAndRedirect(params)

  const csrf = await csrfToken(req, params)
  if (!csrf) return new Response('not_authorized', { status: 401 })
  return new Response(consentPage(params, csrf, url.origin), {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}

// Approve handler: the consent form POSTs here. Re-checks owner auth, the session-bound
// CSRF token, and the redirect allowlist before issuing a code (never trust the GET).
export async function POST(req: NextRequest): Promise<Response> {
  if (!(await mcpEnabled())) return new Response('MCP is disabled', { status: 503 })

  const form = await req.formData().catch(() => null)
  if (!form) return new Response('invalid_request', { status: 400 })
  const src = new URLSearchParams()
  for (const [k, v] of form.entries()) if (typeof v === 'string') src.set(k, v)

  const { params, responseType } = parse(src)
  // The form omits response_type/method (it's an approve of an already-valid GET); pin
  // them to the only values this flow supports so validate() runs identically.
  const bad = await validate(params, 'S256', responseType ?? 'code')
  if (bad) return bad

  const { authorized } = await getAuthState()
  if (!authorized) return new Response('not_authorized', { status: 401 })

  // CSRF is the load-bearing check: an attacker's forged cross-site POST rides the
  // owner's cookies but cannot compute this session-bound token → rejected, no code.
  if (!(await verifyCsrf(req, params, src.get('csrf') ?? ''))) {
    return new Response('invalid_csrf', { status: 403 })
  }
  return issueAndRedirect(params)
}
