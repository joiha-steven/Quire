// MCP Server Card (SEP-1649/2127) — lets an agent discover this site's MCP server
// without prior configuration: what it's called, where its Streamable HTTP endpoint
// is, and how to authenticate (the OAuth metadata already served alongside). The
// server itself lives at /api/mcp (see app/api/mcp/route.ts); this only advertises it.
import { getSettings } from '@/lib/settings'
import { getPublicOrigin, wkOptions, wkJson, APP_VERSION } from '@/lib/well-known'

export const dynamic = 'force-dynamic'

export function OPTIONS(): Response {
  return wkOptions()
}

export async function GET(req: Request): Promise<Response> {
  const origin = getPublicOrigin(req)
  const { title } = await getSettings()
  return wkJson({
    serverInfo: { name: title || 'Quire', version: APP_VERSION },
    transport: { type: 'streamable-http', endpoint: `${origin}/api/mcp` },
    // The MCP exposes tools (content CRUD, search, media); the live list is
    // negotiated over the transport after auth. This advertises the capability class.
    capabilities: { tools: {} },
    authorization: {
      type: 'oauth2',
      authorizationServer: `${origin}/.well-known/oauth-authorization-server`,
      protectedResource: `${origin}/.well-known/oauth-protected-resource`,
    },
    documentation: `${origin}/llms.txt`,
  })
}
