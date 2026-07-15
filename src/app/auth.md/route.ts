// /auth.md — agent registration + authentication instructions in Markdown (the
// WorkOS auth.md convention). It documents the OAuth 2.0 + PKCE flow that already
// guards the MCP server (/api/mcp), pointing at the machine-readable discovery
// metadata so an agent can register a client and obtain a token unattended.
import { getPublicOrigin } from '@/lib/well-known'

export const dynamic = 'force-dynamic'

export function GET(req: Request): Response {
  const origin = getPublicOrigin(req)
  const body = `# Agent authentication

This site exposes a Model Context Protocol (MCP) server for AI agents. It is
guarded by OAuth 2.0 with PKCE and supports dynamic client registration, so an
agent can authenticate without a human pre-provisioning credentials.

## Endpoints

- MCP server (Streamable HTTP): \`${origin}/api/mcp\`
- Authorization server metadata: \`${origin}/.well-known/oauth-authorization-server\`
- Protected resource metadata: \`${origin}/.well-known/oauth-protected-resource\`
- MCP Server Card: \`${origin}/.well-known/mcp/server-card.json\`

## Flow

1. Discover the authorization server via the metadata document above.
2. Register a client at the \`registration_endpoint\` (\`${origin}/api/mcp/register\`)
   to obtain a \`client_id\` (dynamic client registration, RFC 7591).
3. Run the authorization-code + PKCE (S256) flow against \`${origin}/api/mcp/authorize\`
   and exchange the code at \`${origin}/api/mcp/token\`.
4. Call \`${origin}/api/mcp\` with \`Authorization: Bearer <access_token>\`. An
   unauthenticated request returns 401 with a \`WWW-Authenticate\` pointer to the
   protected-resource metadata.

## Content access without auth

Any post or page is available as raw Markdown by requesting its URL with
\`Accept: text/markdown\`. The content index is at \`${origin}/llms.txt\`.
`
  return new Response(body, {
    status: 200,
    headers: { 'content-type': 'text/markdown; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
