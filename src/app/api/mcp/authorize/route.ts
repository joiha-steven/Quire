// OAuth authorization endpoint (thin layer). The owner is the only identity:
// if not signed in as the owner we bounce through NextAuth and come back here;
// once authorized we mint a short-lived PKCE-bound code and redirect it to the
// client's redirect_uri. No consent screen — single-owner auto-approve.

import type { NextRequest } from 'next/server'
import { getAuthState } from '@/lib/auth'
import { issueCode, mcpConfigured } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest): Promise<Response> {
  if (!mcpConfigured()) return new Response('MCP not configured', { status: 503 })

  const url = new URL(req.url)
  const p = url.searchParams
  const redirectUri = p.get('redirect_uri')
  const state = p.get('state') ?? ''
  const challenge = p.get('code_challenge')
  const method = p.get('code_challenge_method')
  const responseType = p.get('response_type')

  if (responseType !== 'code' || !redirectUri || !challenge || method !== 'S256') {
    return new Response('invalid_request (need response_type=code, redirect_uri, S256 PKCE)', { status: 400 })
  }
  let dest: URL
  try {
    dest = new URL(redirectUri)
  } catch {
    return new Response('invalid redirect_uri', { status: 400 })
  }

  // Only the configured owner may authorize. Otherwise sign in, then return here.
  const { authorized } = await getAuthState()
  if (!authorized) {
    const callback = encodeURIComponent(url.pathname + url.search)
    return Response.redirect(`${url.origin}/api/auth/signin?callbackUrl=${callback}`, 302)
  }

  const code = issueCode(redirectUri, challenge)
  dest.searchParams.set('code', code)
  if (state) dest.searchParams.set('state', state)
  return Response.redirect(dest.toString(), 302)
}
