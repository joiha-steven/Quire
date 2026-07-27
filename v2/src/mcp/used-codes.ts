// Single-use enforcement for OAuth authorization codes. Codes are stateless HMAC-signed
// blobs (see auth), so nothing stops a replay on its own — this table records each code's
// jti (nonce) the first time it is exchanged at the token endpoint and makes a second
// exchange fail. Rows carry the code's own expiry so they can be swept once they are no
// longer reachable (a code past `exp` is already rejected upstream). SERVER-ONLY.

import { run } from '@/store/query'

// Consume a code's jti exactly once. Returns true on the FIRST call (the insert
// succeeds → this exchange may proceed); false if the jti is already present (replay)
// or the insert fails. The PRIMARY KEY on `jti` makes the check atomic — a duplicate
// insert raises a constraint error, which we treat as "already used".
//
// PostgREST returned that as an error object; `bun:sqlite` throws. Same decision either
// way, and the catch must stay broad: any failure means refuse the exchange, because
// letting a code through on a transient error is the one outcome that matters.
export async function consumeCodeJti(jti: string, expMs: number): Promise<boolean> {
  try {
    run(`insert into mcp_used_codes (jti, expires_at) values (?, ?)`, jti, expMs)
    return true
  } catch {
    return false
  }
}
