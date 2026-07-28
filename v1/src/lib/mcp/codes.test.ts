import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHash } from 'node:crypto'

// Single-use authorization codes (replay guard): a code is a stateless HMAC blob, so
// nothing stops a replay on its own — verifyCode must consume the code's jti exactly
// once. First exchange succeeds; a SECOND exchange of the same code is rejected.
//
// The mock db() models the `mcp_used_codes` PRIMARY KEY: inserting a jti that's already
// present returns a unique-violation error (which consumeCodeJti treats as "already
// used"). So a real replay drives the insert→error→false path these tests pin.
const used = vi.hoisted(() => new Set<string>())

vi.mock('@/lib/db', () => {
  type Row = { jti: string; expires_at: string }
  const builder = {
    insert: (row: Row) => {
      if (used.has(row.jti)) return Promise.resolve({ error: { message: 'duplicate key value violates unique constraint' } })
      used.add(row.jti)
      return Promise.resolve({ error: null })
    },
  }
  return { DB_TAG: 'db', db: () => ({ from: () => builder }) }
})

// getSettings is imported by auth.ts (verifyMcpToken); unused here but must resolve.
vi.mock('@/lib/settings', () => ({ getSettings: () => Promise.resolve({ mcp: { enabled: true } }) }))
vi.mock('@/lib/mcp/tokens', () => ({ verifyTokenHash: () => Promise.resolve(null) }))

import { issueCode, verifyCode } from '@/lib/mcp/auth'

const REDIRECT = 'http://127.0.0.1:49152/callback'
const VERIFIER = 'a'.repeat(64) // PKCE code_verifier
const challenge = createHash('sha256').update(VERIFIER).digest('base64url')

beforeEach(() => {
  used.clear()
  vi.stubEnv('MCP_OAUTH_SECRET', 'test-oauth-secret')
})

describe('single-use authorization codes (replay guard)', () => {
  it('accepts a valid code on first exchange', async () => {
    const code = issueCode(REDIRECT, challenge)
    expect(await verifyCode(code, REDIRECT, VERIFIER)).toBe(true)
  })

  it('rejects the SAME code on a second exchange (replay)', async () => {
    const code = issueCode(REDIRECT, challenge)
    expect(await verifyCode(code, REDIRECT, VERIFIER)).toBe(true)
    expect(await verifyCode(code, REDIRECT, VERIFIER)).toBe(false)
  })

  it('rejects a code whose redirect_uri does not match', async () => {
    const code = issueCode(REDIRECT, challenge)
    expect(await verifyCode(code, 'http://localhost:9999/other', VERIFIER)).toBe(false)
  })

  it('rejects a code with a wrong PKCE verifier (no jti burned)', async () => {
    const code = issueCode(REDIRECT, challenge)
    expect(await verifyCode(code, REDIRECT, 'b'.repeat(64))).toBe(false)
    // jti was NOT consumed by the failed attempt → the correct verifier still works once.
    expect(await verifyCode(code, REDIRECT, VERIFIER)).toBe(true)
  })

  it('rejects a tampered code (bad signature)', async () => {
    const code = issueCode(REDIRECT, challenge)
    expect(await verifyCode(`${code}x`, REDIRECT, VERIFIER)).toBe(false)
  })
})
