// MCP auth: a single full-access bearer token (`MCP_TOKEN`) plus a thin OAuth 2.1
// layer so connectors that require OAuth discovery (ChatGPT, Claude) can obtain
// that token after the OWNER approves. The OAuth flow issues short-lived,
// HMAC-signed authorization codes (with PKCE); the token endpoint then hands back
// the static MCP_TOKEN as the access token — "one token, full power". There is no
// user database: the only identity is the configured blog owner (NextAuth).
//
// SERVER-ONLY. The token is the keys to the whole admin surface — never expose it.

import { createHmac, createHash, timingSafeEqual } from 'node:crypto'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'

const token = (): string => process.env.MCP_TOKEN ?? ''
// The OAuth codes are signed with MCP_OAUTH_SECRET, falling back to AUTH_SECRET so
// a self-hoster only has to set one secret.
const secret = (): string => process.env.MCP_OAUTH_SECRET || process.env.AUTH_SECRET || ''

// MCP is enabled only when a token is configured; otherwise every entry point 401/503s.
export function mcpConfigured(): boolean {
  return token() !== '' && secret() !== ''
}

// Constant-time string compare (lengths may differ → false without leaking).
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// withMcpAuth verifyToken: accept the configured MCP_TOKEN as a full-access bearer.
export async function verifyMcpToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer || !mcpConfigured() || !safeEq(bearer, token())) return undefined
  return { token: bearer, clientId: 'owner', scopes: ['full'] }
}

// ----- thin OAuth: HMAC-signed authorization codes (carry PKCE challenge) -------

type CodePayload = { redirectUri: string; challenge: string; exp: number }

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

// Mint a short-lived code bound to the client's redirect_uri + PKCE challenge.
export function issueCode(redirectUri: string, challenge: string, ttlSec = 300): string {
  const payload: CodePayload = { redirectUri, challenge, exp: Date.now() + ttlSec * 1000 }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

// Validate a code at the token endpoint: signature, expiry, redirect_uri match and
// PKCE (S256) — the verifier must hash to the challenge baked into the code.
export function verifyCode(code: string, redirectUri: string, verifier: string): boolean {
  const [body, sig] = code.split('.')
  if (!body || !sig || !safeEq(sig, sign(body))) return false
  let p: CodePayload
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString()) as CodePayload
  } catch {
    return false
  }
  if (Date.now() > p.exp || p.redirectUri !== redirectUri) return false
  const computed = createHash('sha256').update(verifier).digest('base64url')
  return safeEq(computed, p.challenge)
}

// The access token handed out after a valid code exchange = the static MCP_TOKEN.
export function accessToken(): string {
  return token()
}
