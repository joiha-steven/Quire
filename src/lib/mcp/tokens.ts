// MCP access tokens, managed from Admin → Settings → Advanced. Each token is a
// high-entropy random string shown ONCE on creation; only its SHA-256 hash is
// stored (`mcp_tokens` table), so a leaked DB never yields a usable token. Up to
// MAX_TOKENS may exist at once. SERVER-ONLY.

import { createHash, randomBytes } from 'node:crypto'
import { db } from '@/lib/db'

const MAX_TOKENS = 5
const TOKEN_PREFIX = 'vbmcp_'

// What the admin UI sees — never the secret itself.
export type McpTokenInfo = {
  id: number
  name: string
  prefix: string // short non-secret display hint, e.g. "vbmcp_AbCd"
  createdAt: string
  lastUsedAt: string | null
}

type TokenRow = { id: number; name: string; prefix: string; created_at: string; last_used_at: string | null }

const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex')

const toInfo = (r: TokenRow): McpTokenInfo => ({
  id: r.id,
  name: r.name,
  prefix: r.prefix,
  createdAt: r.created_at,
  lastUsedAt: r.last_used_at,
})

export const tokenLimit = (): number => MAX_TOKENS

// All tokens (metadata only), newest first.
export async function listTokens(): Promise<McpTokenInfo[]> {
  const { data } = await db()
    .from('mcp_tokens')
    .select('id,name,prefix,created_at,last_used_at')
    .order('created_at', { ascending: false })
  return ((data as TokenRow[] | null) ?? []).map(toInfo)
}

export async function countTokens(): Promise<number> {
  const { count } = await db().from('mcp_tokens').select('id', { count: 'exact', head: true })
  return count ?? 0
}

// Mint a named token. Returns the PLAINTEXT once (never stored again). Throws
// 'token_limit' when MAX_TOKENS already exist.
export async function createToken(name: string): Promise<{ token: string; info: McpTokenInfo }> {
  if ((await countTokens()) >= MAX_TOKENS) throw new Error('token_limit')
  const token = `${TOKEN_PREFIX}${randomBytes(24).toString('base64url')}`
  const prefix = token.slice(0, 12)
  const { data, error } = await db()
    .from('mcp_tokens')
    .insert({ name: name.trim().slice(0, 80) || 'Token', token_hash: sha256(token), prefix })
    .select('id,name,prefix,created_at,last_used_at')
    .single()
  if (error) throw new Error(`createToken: ${error.message}`)
  return { token, info: toInfo(data as TokenRow) }
}

export async function deleteToken(id: number): Promise<void> {
  await db().from('mcp_tokens').delete().eq('id', id)
}

// Remove every token with this name (used to replace a connector's prior token).
export async function deleteTokensByName(name: string): Promise<void> {
  await db().from('mcp_tokens').delete().eq('name', name)
}

// Verify a presented bearer: hash + lookup. On a match, stamp last_used_at and
// return the token's id/name; otherwise null.
export async function verifyTokenHash(bearer: string): Promise<{ id: number; name: string } | null> {
  const { data } = await db().from('mcp_tokens').select('id,name').eq('token_hash', sha256(bearer)).maybeSingle()
  if (!data) return null
  const r = data as { id: number; name: string }
  await db().from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', r.id)
  return r
}
