// MCP access tokens, managed from Admin → Settings → Advanced. Each token is a
// high-entropy random string shown ONCE on creation; only its SHA-256 hash is
// stored (`mcp_tokens` table), so a leaked DB never yields a usable token. Up to
// MAX_TOKENS may exist at once. SERVER-ONLY.

import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

const MAX_TOKENS = 5 // manual (admin-created) tokens only
const TOKEN_PREFIX = 'vbmcp_'
const TOKEN_TTL_DAYS = 180 // every token expires this long after creation

// Expiry stamp for a freshly minted token (created_at + TTL).
const expiryISO = (): string => new Date(Date.now() + TOKEN_TTL_DAYS * 86_400_000).toISOString()

// OAuth-issued tokens share this name and are managed separately from manual ones:
// exempt from MAX_TOKENS. They are NEVER auto-deleted — a connection persists until
// the owner deletes it in the admin (the admin is the sole authority over a
// connection's lifecycle); deleting from Claude alone just lets it re-authorize.
export const OAUTH_TOKEN_NAME = 'OAuth connector'

// What the admin UI sees — never the secret itself.
export type McpTokenInfo = {
  id: number
  name: string
  prefix: string // short non-secret display hint, e.g. "vbmcp_AbCd"
  createdAt: string
  expiresAt: string // created_at + 180d; rejected once past
  expired: boolean // computed server-side (past expiresAt) for display
  lastUsedAt: string | null
  oauth: boolean // true = machine-issued via OAuth (not a manual admin token)
}

type TokenRow = { id: number; name: string; prefix: string; created_at: string; expires_at: string; last_used_at: string | null }

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

const toInfo = (r: TokenRow): McpTokenInfo => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
  expired: Date.parse(r.expires_at) <= Date.now(),
  lastUsedAt: r.last_used_at,
  oauth: r.name === OAUTH_TOKEN_NAME,
})

export const tokenLimit = (): number => MAX_TOKENS

// All tokens (metadata only), newest first.
export async function listTokens(): Promise<McpTokenInfo[]> {
  const { data } = await db()
    .from('mcp_tokens')
    .select('id,name,prefix,created_at,expires_at,last_used_at')
    .order('created_at', { ascending: false })
  return ((data as TokenRow[] | null) ?? []).map(toInfo)
}

// Count manual (admin-created) tokens — OAuth-issued ones are exempt from the cap.
async function countManualTokens(): Promise<number> {
  const { count } = await db().from('mcp_tokens').select('id', { count: 'exact', head: true }).neq('name', OAUTH_TOKEN_NAME)
  return count ?? 0
}

const newSecret = (): { token: string; prefix: string } => {
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`
  return { token, prefix: token.slice(0, 12) }
}

// Mint a named MANUAL token. Returns the PLAINTEXT once (never stored again).
// Throws 'token_limit' when MAX_TOKENS manual tokens already exist.
export async function createToken(name: string): Promise<{ token: string; info: McpTokenInfo }> {
  if ((await countManualTokens()) >= MAX_TOKENS) throw new Error('token_limit')
  const { token, prefix } = newSecret()
  const { data, error } = await db()
    .from('mcp_tokens')
    .insert({ name: name.trim().slice(0, 80) || 'Token', token_hash: sha256(token), prefix, expires_at: expiryISO() })
    .select('id,name,prefix,created_at,expires_at,last_used_at')
    .single()
  if (error) throw new Error(`createToken: ${error.message}`)
  return { token, info: toInfo(data as TokenRow) }
}

// Mint the OAuth-connector token (called by /api/mcp/token). NEVER deletes any token
// (the in-use one survives a re-authorize; nothing auto-prunes — the owner alone
// removes connections in the admin). Exempt from the manual cap → authorizing never
// fails with "limit reached". Eternal (no expiry) → connect once, stays connected.
export async function mintOAuthToken(): Promise<{ token: string; info: McpTokenInfo }> {
  const { token, prefix } = newSecret()
  const { data, error } = await db()
    .from('mcp_tokens')
    .insert({ name: OAUTH_TOKEN_NAME, token_hash: sha256(token), prefix, expires_at: expiryISO() })
    .select('id,name,prefix,created_at,expires_at,last_used_at')
    .single()
  if (error) throw new Error(`mintOAuthToken: ${error.message}`)
  return { token, info: toInfo(data as TokenRow) }
}

export async function deleteToken(id: number): Promise<void> {
  await db().from('mcp_tokens').delete().eq('id', id)
}

// Verify a presented bearer: hash + lookup. Rejects an expired token (past
// expires_at). On a live match, stamps last_used_at and returns the token's
// id/name; otherwise null.
export async function verifyTokenHash(bearer: string): Promise<{ id: number; name: string } | null> {
  const { data } = await db().from('mcp_tokens').select('id,name,expires_at').eq('token_hash', sha256(bearer)).maybeSingle()
  if (!data) return null
  const r = data as { id: number; name: string; expires_at: string }
  if (Date.parse(r.expires_at) <= Date.now()) return null // expired → treat as invalid
  await db().from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', r.id)
  return { id: r.id, name: r.name }
}
