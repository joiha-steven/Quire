// OAuth Protected Resource Metadata (RFC 9728). The MCP 401 points clients here;
// it tells them which authorization server guards /api/mcp (this same origin).

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
    { resource: `${origin}/api/mcp`, authorization_servers: [origin] },
    { status: 200, headers: CORS },
  )
}
