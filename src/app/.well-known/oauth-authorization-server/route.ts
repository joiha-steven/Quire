// OAuth Authorization Server Metadata (RFC 8414). Advertises the thin OAuth
// endpoints so connectors can discover and run the authorization-code + PKCE flow.

import { getPublicOrigin } from 'mcp-handler'

export const dynamic = 'force-dynamic'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

export function GET(req: Request): Response {
  const origin = getPublicOrigin(req)
  return Response.json(
    {
      issuer: origin,
      authorization_endpoint: `${origin}/api/mcp/authorize`,
      token_endpoint: `${origin}/api/mcp/token`,
      registration_endpoint: `${origin}/api/mcp/register`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
      scopes_supported: ['full'],
    },
    { status: 200, headers: CORS },
  )
}
