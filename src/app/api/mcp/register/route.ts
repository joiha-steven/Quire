// OAuth Dynamic Client Registration (RFC 7591), thin layer. Connectors register a
// client before the auth flow; we accept any request and echo back a fixed
// public client_id (no client secret — PKCE secures the flow). No persistence:
// the authorization/token endpoints don't validate client_id beyond its presence.

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
  const body = (await req.json().catch(() => ({}))) as { redirect_uris?: unknown; client_name?: unknown }
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === 'string')
    : []
  return Response.json(
    {
      client_id: 'vibeblog-mcp',
      client_id_issued_at: Math.floor(Date.now() / 1000),
      token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code'],
      response_types: ['code'],
      redirect_uris: redirectUris,
      client_name: typeof body.client_name === 'string' ? body.client_name : 'MCP Client',
    },
    { status: 201, headers: CORS },
  )
}
