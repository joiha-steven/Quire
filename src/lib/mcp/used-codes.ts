// Single-use enforcement for OAuth authorization codes. Codes are stateless
// HMAC-signed blobs (see auth.ts) so nothing stops a replay on its own — this table
// records each code's jti (nonce) the first time it's exchanged at /api/mcp/token and
// makes a second exchange fail. Rows carry the code's own expiry so they can be swept
// after they're no longer reachable (a code past `exp` is already rejected upstream).
// SERVER-ONLY.

import { db } from '@/lib/db'

// Consume a code's jti exactly once. Returns true on the FIRST call (the insert
// succeeds → this exchange may proceed); false if the jti is already present (replay)
// or the insert fails. The PRIMARY KEY on `jti` makes the check atomic — a duplicate
// insert errors with a unique-violation, which we treat as "already used".
export async function consumeCodeJti(jti: string, expMs: number): Promise<boolean> {
  const { error } = await db()
    .from('mcp_used_codes')
    .insert({ jti, expires_at: new Date(expMs).toISOString() })
  // No error => first use. Any error (unique violation on replay, or a transient
  // failure) => refuse the exchange; the connector can re-authorize for a fresh code.
  return !error
}
