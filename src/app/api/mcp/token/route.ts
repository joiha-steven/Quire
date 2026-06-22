// OAuth token endpoint (thin layer). Exchanges a valid authorization code +
// PKCE verifier for the access token — which is the static MCP_TOKEN ("one token,
// full power"). Public client (token_endpoint_auth_method=none); the code's
// signature + PKCE are what gate this.

import { verifyCode, accessToken, mcpConfigured } from '@/lib/mcp/auth'

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
  if (!mcpConfigured()) return Response.json({ error: 'temporarily_unavailable' }, { status: 503, headers: CORS })

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
  // The access token is the full-access MCP_TOKEN; it does not expire (single owner).
  return Response.json({ access_token: accessToken(), token_type: 'Bearer', scope: 'full' }, { status: 200, headers: CORS })
}
