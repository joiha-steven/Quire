// The MCP endpoint at /api/mcp: Streamable HTTP, wired to the SDK by hand.
//
// The frozen tree used `mcp-handler`, which wraps the SDK for Next's route handlers and
// cannot be moved here. So this is the one piece of M3 that is a rewrite rather than a
// port — and it is a small one, because the protocol's stateless mode is exactly what a
// blog needs: every call is a JSON-RPC request in a POST body and a JSON-RPC response in
// the reply. No session id, no SSE stream, no server-initiated messages.
//
// A fresh `McpServer` per request. That sounds wasteful and is not: registering the tools
// is building a table of closures, the tools hold no state between calls, and the
// alternative — one long-lived server plus a session registry — is a cache to invalidate
// and a leak to bound, bought for nothing.

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js'
import type { Context } from 'hono'
import { registerTools } from '@/mcp/tools'
import { verifyMcpToken } from '@/mcp/auth'
import { getSettings, resolveSiteUrl } from '@/content/settings'

/**
 * A transport that carries exactly one exchange.
 *
 * `send` resolves the promise the handler is awaiting rather than writing to a socket:
 * the reply IS the HTTP response body, so there is nowhere else for it to go.
 */
class SingleExchange implements Transport {
  onclose?: () => void
  onerror?: (error: Error) => void
  onmessage?: (message: JSONRPCMessage) => void

  private resolve!: (message: JSONRPCMessage | null) => void
  readonly reply = new Promise<JSONRPCMessage | null>((r) => { this.resolve = r })

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    this.resolve(message)
  }

  async close(): Promise<void> {
    // A notification produces no reply, and the caller must not hang waiting for one.
    this.resolve(null)
    this.onclose?.()
  }

  /** Hand an incoming message to the server and wait for what it sends back. */
  async exchange(message: JSONRPCMessage): Promise<JSONRPCMessage | null> {
    this.onmessage?.(message)
    return this.reply
  }
}

const jsonRpcError = (id: unknown, code: number, message: string) =>
  Response.json({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

export async function handleMcp(c: Context): Promise<Response> {
  const settings = await getSettings()
  // The owner's switch. Off means the endpoint is not there, rather than there and
  // refusing: a disabled feature should not leave a probe-able surface behind.
  if (!settings.mcp.enabled) return c.text('Not found', 404)

  const site = resolveSiteUrl(settings)
  // A 401 has to point the client at the metadata that starts the OAuth flow, or a
  // connector has no way to discover how to authenticate. That header IS the handshake.
  const unauthorized = () => new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: {
      'content-type': 'application/json',
      'www-authenticate':
        `Bearer resource_metadata="${site}/.well-known/oauth-protected-resource"`,
    },
  })

  const auth = c.req.header('authorization') ?? ''
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
  if (!token || !(await verifyMcpToken(token))) return unauthorized()

  // DELETE ends a session, and there are no sessions to end. GET would open the SSE
  // stream this deliberately does not implement. Both are answered, not ignored.
  if (c.req.method === 'DELETE') return new Response(null, { status: 204 })
  if (c.req.method === 'GET') return c.text('Method Not Allowed', 405)

  let message: JSONRPCMessage
  try {
    message = await c.req.json() as JSONRPCMessage
  } catch {
    return jsonRpcError(null, -32700, 'Parse error')
  }

  const server = new McpServer({ name: 'quire', version: '2.0' })
  registerTools(server)
  const transport = new SingleExchange()
  await server.connect(transport)

  try {
    const reply = await transport.exchange(message)
    // A notification gets 202 with no body, which is what the specification asks for.
    if (reply === null) return new Response(null, { status: 202 })
    return Response.json(reply)
  } catch (error) {
    console.error(`[ERROR] mcp: ${(error as Error).message}`)
    return jsonRpcError((message as { id?: unknown }).id, -32603, 'Internal error')
  } finally {
    await server.close().catch(() => {})
  }
}
