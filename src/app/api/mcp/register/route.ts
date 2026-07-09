// OAuth Dynamic Client Registration (RFC 7591), thin layer. A connector registers
// before the auth flow; we mint a unique client_id and PERSIST it with the client's
// redirect_uris (`mcp_clients` table). No client secret — PKCE secures the flow. The
// authorize endpoint then accepts a redirect_uri ONLY if it exactly matches one
// registered here (or is a loopback address), closing the open-redirect hole.

import { registerClient } from '@/lib/mcp/clients'
import { mcpEnabled } from '@/lib/mcp/auth'

export const dynamic = 'force-dynamic'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

// Unauthenticated endpoint: cap registrations per IP so a script can't flood the
// `mcp_clients` table (each POST inserts a row). Best-effort, per-instance.
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()
function rateLimited(ip: string): boolean {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  return recent.length > MAX_PER_WINDOW
}

export function OPTIONS(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(req: Request): Promise<Response> {
  // Registration is only useful when MCP is on; refuse otherwise (matches /authorize,
  // /token) so a disabled server can't be used to grow the clients table.
  if (!(await mcpEnabled())) {
    return Response.json({ error: 'temporarily_unavailable' }, { status: 503, headers: CORS })
  }
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  if (rateLimited(ip)) {
    return Response.json({ error: 'too_many_requests' }, { status: 429, headers: CORS })
  }
  const body = (await req.json().catch(() => ({}))) as { redirect_uris?: unknown; client_name?: unknown }
  const redirectUris = Array.isArray(body.redirect_uris)
    ? body.redirect_uris.filter((u): u is string => typeof u === 'string')
    : []
  // A non-loopback flow can't authorize without a registered redirect_uri, so require
  // at least one here (RFC 7591 §3.2.2 allows rejecting an invalid client metadata).
  if (redirectUris.length === 0) {
    return Response.json(
      { error: 'invalid_redirect_uri', error_description: 'redirect_uris is required' },
      { status: 400, headers: CORS },
    )
  }
  let clientId: string
  try {
    clientId = await registerClient(redirectUris)
  } catch {
    return Response.json({ error: 'server_error' }, { status: 500, headers: CORS })
  }
  return Response.json(
    {
      client_id: clientId,
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
