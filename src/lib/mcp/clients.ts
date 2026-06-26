// OAuth Dynamic Client Registration store + redirect_uri validation. A connector
// POSTs its redirect_uris to /api/mcp/register; we persist them under a freshly
// minted client_id (`mcp_clients` table). /api/mcp/authorize then accepts a
// redirect_uri ONLY if it exactly matches one registered for that client_id — this
// closes the open-redirect → owner-account-takeover hole (an attacker can no longer
// point a freshly minted code at an arbitrary host). SERVER-ONLY.

import { randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

export type RegisteredClient = { clientId: string; redirectUris: string[] }

type ClientRow = { client_id: string; redirect_uris: string[] }

// A localhost loopback redirect is the standard native-app exception (RFC 8252 §7.3):
// real MCP desktop clients spin up an ephemeral http://127.0.0.1:PORT listener, so the
// exact port can't be pre-registered. We allow loopback hosts on http with any port (or
// none) and nothing else — never a public http origin. Exported so /authorize can branch:
// loopback (the user's own machine) auto-approves, everything else needs a consent click.
export function isLoopbackRedirect(uri: string): boolean {
  let u: URL
  try {
    u = new URL(uri)
  } catch {
    return false
  }
  if (u.protocol !== 'http:') return false // loopback exception is http-only
  const host = u.hostname
  return host === '127.0.0.1' || host === 'localhost' || host === '[::1]' || host === '::1'
}

// Persist a newly registered client. Returns the minted client_id. redirect_uris are
// stored verbatim and matched exactly at authorize time.
export async function registerClient(redirectUris: string[]): Promise<string> {
  const clientId = `mcp_${randomBytes(18).toString('base64url')}`
  const { error } = await db()
    .from('mcp_clients')
    .insert({ client_id: clientId, redirect_uris: redirectUris })
  if (error) throw new Error(`registerClient: ${error.message}`)
  return clientId
}

async function getClient(clientId: string): Promise<RegisteredClient | null> {
  const { data } = await db()
    .from('mcp_clients')
    .select('client_id,redirect_uris')
    .eq('client_id', clientId)
    .maybeSingle()
  if (!data) return null
  const r = data as ClientRow
  return { clientId: r.client_id, redirectUris: Array.isArray(r.redirect_uris) ? r.redirect_uris : [] }
}

// Authorize-time gate: a redirect_uri is allowed iff it is a loopback address OR it
// exactly matches one registered for the given client_id. Loopback is allowed even
// without a known client (desktop clients may not pre-register). Returns false for an
// unknown client_id with a non-loopback uri, or any uri not in the client's list.
export async function isRedirectAllowed(clientId: string, redirectUri: string): Promise<boolean> {
  if (isLoopbackRedirect(redirectUri)) return true
  if (!clientId) return false
  const client = await getClient(clientId)
  return client ? client.redirectUris.includes(redirectUri) : false
}
