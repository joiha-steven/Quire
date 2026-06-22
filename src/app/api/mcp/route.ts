// Remote MCP endpoint (Streamable HTTP) at /api/mcp. Lets an MCP client (Claude,
// ChatGPT, …) operate the blog with the SAME data layer as the admin UI. Gated by
// a single full-access bearer (`MCP_TOKEN`); connectors that require OAuth obtain
// that token via the thin OAuth layer (see /api/mcp/authorize|token|register and
// the /.well-known/* metadata routes). Tools live in src/lib/mcp.

import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { registerTools } from '@/lib/mcp/tools'
import { verifyMcpToken } from '@/lib/mcp/auth'

// Tools do real work (DB writes, blob fetches); give them headroom.
export const maxDuration = 60

const handler = createMcpHandler(
  (server) => {
    registerTools(server)
  },
  {},
  { basePath: '/api' }, // derives the Streamable HTTP endpoint at /api/mcp
)

// Require a valid bearer on every request; an unauthenticated call gets a 401 that
// points the client at /.well-known/oauth-protected-resource to start the flow.
const authed = withMcpAuth(handler, verifyMcpToken, { required: true })

export { authed as GET, authed as POST, authed as DELETE }
