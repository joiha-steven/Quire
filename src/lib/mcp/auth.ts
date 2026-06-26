// MCP auth: access tokens are admin-managed (see tokens.ts) and the endpoint is
// gated by a settings toggle. The thin OAuth 2.1 layer lets connectors that
// require OAuth obtain a token after the OWNER approves: the /token exchange mints
// a managed token and hands it back (see /api/mcp/token). The only identity is the
// configured blog owner (NextAuth). SERVER-ONLY.

import { createHmac, createHash, timingSafeEqual, randomBytes } from 'node:crypto'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import { getSettings } from '@/lib/settings'
import { verifyTokenHash } from '@/lib/mcp/tokens'
import { consumeCodeJti } from '@/lib/mcp/used-codes'

// OAuth codes are signed with MCP_OAUTH_SECRET, falling back to AUTH_SECRET so a
// self-hoster only has to set one secret.
const secret = (): string => process.env.MCP_OAUTH_SECRET || process.env.AUTH_SECRET || ''

// MCP is live only when the owner has switched it on (Admin → Settings → Advanced).
export async function mcpEnabled(): Promise<boolean> {
  try {
    return (await getSettings()).mcp.enabled
  } catch {
    return false
  }
}

// Constant-time string compare (lengths may differ → false without leaking).
function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// withMcpAuth verifyToken: accept any live managed token while MCP is enabled.
export async function verifyMcpToken(_req: Request, bearer?: string): Promise<AuthInfo | undefined> {
  if (!bearer || !(await mcpEnabled())) return undefined
  const hit = await verifyTokenHash(bearer)
  if (!hit) return undefined
  return { token: bearer, clientId: `token:${hit.id}`, scopes: ['full'] }
}

// ----- thin OAuth: HMAC-signed authorization codes (carry PKCE challenge) -------

// `jti` is a per-code nonce → makes the code single-use: the token endpoint records
// it in `mcp_used_codes` on first exchange and rejects any later code carrying the
// same jti (see used-codes.ts). Without it the stateless HMAC code would be replayable.
type CodePayload = { redirectUri: string; challenge: string; exp: number; jti: string }

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url')
}

// Mint a short-lived code bound to the client's redirect_uri + PKCE challenge, with a
// random jti so it can be consumed exactly once at the token endpoint.
export function issueCode(redirectUri: string, challenge: string, ttlSec = 300): string {
  const exp = Date.now() + ttlSec * 1000
  const payload: CodePayload = { redirectUri, challenge, exp, jti: randomBytes(16).toString('base64url') }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body)}`
}

// Validate a code at the token endpoint: signature, expiry, redirect_uri match, PKCE
// (S256, the verifier must hash to the baked-in challenge) AND single-use — the jti is
// atomically consumed; a second exchange of the same code (replay) is rejected. Async
// because the consume step persists the jti. Returns false on ANY failure.
export async function verifyCode(code: string, redirectUri: string, verifier: string): Promise<boolean> {
  const [body, sig] = code.split('.')
  if (!body || !sig || !safeEq(sig, sign(body))) return false
  let p: CodePayload
  try {
    p = JSON.parse(Buffer.from(body, 'base64url').toString()) as CodePayload
  } catch {
    return false
  }
  if (Date.now() > p.exp || p.redirectUri !== redirectUri || !p.jti) return false
  const computed = createHash('sha256').update(verifier).digest('base64url')
  if (!safeEq(computed, p.challenge)) return false
  // Single-use: consume the jti LAST (after all stateless checks pass) so an invalid
  // code never burns a nonce. A false here means it was already consumed (replay).
  return consumeCodeJti(p.jti, p.exp)
}
