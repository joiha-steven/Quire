// OAuth token endpoint (thin layer). Exchanges a valid authorization code + PKCE
// verifier for an eternal access token (mintOAuthToken — never pre-deletes, so a
// re-authorize can't kill the connector's in-use token; bounded rolling window).
// Public client (token_endpoint_auth_method=none); the code's signature + PKCE gate this.

import { verifyCode, mcpEnabled } from '@/lib/mcp/auth'
import { mintOAuthToken } from '@/lib/mcp/tokens'

export const dynamic = 'force-dynamic'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {
  if (!(await mcpEnabled())) return Response.json({ error: 'temporarily_unavailable' }, { status: 503, headers: CORS })

  const form = await req.formData().catch(() => null)
  if (!form) return Response.json({ error: 'invalid_request' }, { status: 400, headers: CORS })

  const grantType = String(form.get('grant_type') ?? '')
  const code = String(form.get('code') ?? '')
  const redirectUri = String(form.get('redirect_uri') ?? '')
  const verifier = String(form.get('code_verifier') ?? '')

  if (grantType !== 'authorization_code') {
    return Response.json({ error: 'unsupported_grant_type' }, { status: 400, headers: CORS })
  }
  if (!code || !redirectUri || !verifier || !verifyCode(code, redirectUri, verifier)) {
    return Response.json({ error: 'invalid_grant' }, { status: 400, headers: CORS })
  }
  // Mint a fresh eternal token; old OAuth tokens stay valid (bounded window) so a
  // re-auth never breaks the connector. Exempt from the manual cap → can't hit a limit.
  let minted
  try {
    minted = await mintOAuthToken()
  } catch {
    return Response.json({ error: 'server_error', error_description: 'could not mint token' }, { status: 500, headers: CORS })
  }
  return Response.json({ access_token: minted.token, token_type: 'Bearer', scope: 'full' }, { status: 200, headers: CORS })
}
