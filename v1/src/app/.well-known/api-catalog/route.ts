// API Catalog (RFC 9727) — an application/linkset+json document that points an
// agent at this site's machine surfaces: the MCP server (the primary API), its
// server card (service description), the content index, and a health probe. Served
// at /.well-known/api-catalog; also advertised via a Link header on the homepage.
import { getPublicOrigin, wkOptions, wkJson } from '@/lib/well-known'

export const dynamic = 'force-dynamic'

export function OPTIONS(): Response {
  return wkOptions()
}

export function GET(req: Request): Response {
  const origin = getPublicOrigin(req)
  return wkJson(
    {
      linkset: [
        {
          anchor: `${origin}/api/mcp`,
          // MCP Server Card = the machine-readable description of this API.
          'service-desc': [
            { href: `${origin}/.well-known/mcp/server-card.json`, type: 'application/json' },
          ],
          // Human/agent-readable content index.
          'service-doc': [{ href: `${origin}/llms.txt`, type: 'text/plain' }],
          // Liveness probe.
          status: [{ href: `${origin}/api/health`, type: 'application/json' }],
        },
      ],
    },
    'application/linkset+json',
  )
}
