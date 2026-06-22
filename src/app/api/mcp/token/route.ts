// OAuth token endpoint (thin layer). Exchanges a valid authorization code + PKCE
// verifier for an access token: we MINT a managed token (replacing this
// connector's previous one so it doesn't pile up) and return it. Public client
// (token_endpoint_auth_method=none); the code's signature + PKCE gate this.

import { verifyCode, mcpEnabled } from '@/lib/mcp/auth'
import { createToken, deleteTokensByName } from '@/lib/mcp/tokens'

export const dynamic = 'force-dynamic'

// All OAuth-issued tokens share this name → one slot, refreshed on each connect.
const OAUTH_TOKEN_NAME = 'OAuth connector'

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
  // Replace this connector's prior token, then mint a fresh one (full-access, no
  // expiry — single owner). Fails if the 5-token cap is full and no OAuth slot frees.
  await deleteTokensByName(OAUTH_TOKEN_NAME)
  let minted
  try {
    minted = await createToken(OAUTH_TOKEN_NAME)
  } catch {
    return Response.json({ error: 'invalid_request', error_description: 'token limit reached — delete an MCP token in admin' }, { status: 400, headers: CORS })
  }
  return Response.json({ access_token: minted.token, token_type: 'Bearer', scope: 'full' }, { status: 200, headers: CORS })
}
