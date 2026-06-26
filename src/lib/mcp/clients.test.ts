import { describe, it, expect, beforeEach, vi } from 'vitest'

// Open-redirect → owner-takeover guard: /api/mcp/authorize must only ever redirect a
// freshly minted code to a redirect_uri the client REGISTERED (exact match) or a
// loopback address. This pins isRedirectAllowed: a registered match passes, an
// arbitrary attacker host is rejected, and loopback is allowed without registration.
//
// The mock db() builder applies the .eq filter the code chains over a seeded set of
// registered clients, so isRedirectAllowed exercises the real lookup + match logic.
type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ clients: [] as Row[] }))

vi.mock('@/lib/db', () => {
  type Query = {
    select: () => Query
    insert: (row: Row) => Query
    eq: (col: string, val: unknown) => Query
    maybeSingle: () => Promise<{ data: Row | null; error: null }>
    then: (resolve: (v: { data: null; error: null }) => unknown) => unknown
  }
  const makeBuilder = (rows: Row[]): Query => {
    const filters: ((r: Row) => boolean)[] = []
    const result = () => rows.filter((r) => filters.every((f) => f(r)))
    const q: Query = {
      select: () => q,
      insert: (row) => { rows.push(row); return q },
      eq: (col, val) => { filters.push((r) => r[col] === val); return q },
      maybeSingle: () => Promise.resolve({ data: result()[0] ?? null, error: null }),
      then: (resolve) => resolve({ data: null, error: null }),
    }
    return q
  }
  return { DB_TAG: 'db', db: () => ({ from: () => makeBuilder(state.clients) }) }
})

import { isRedirectAllowed } from '@/lib/mcp/clients'

const REGISTERED = 'https://app.example.com/oauth/callback'

beforeEach(() => {
  state.clients = [{ client_id: 'client-1', redirect_uris: [REGISTERED] }]
})

describe('redirect_uri allowlist (open-redirect guard)', () => {
  it('allows a redirect_uri exactly registered for the client', async () => {
    expect(await isRedirectAllowed('client-1', REGISTERED)).toBe(true)
  })

  it('rejects an arbitrary attacker host not registered for the client', async () => {
    expect(await isRedirectAllowed('client-1', 'https://evil.attacker.test/steal')).toBe(false)
  })

  it('rejects a uri for an unknown client_id', async () => {
    expect(await isRedirectAllowed('no-such-client', REGISTERED)).toBe(false)
  })

  it('rejects a near-miss (subdomain) of a registered uri', async () => {
    expect(await isRedirectAllowed('client-1', 'https://app.example.com.evil.test/oauth/callback')).toBe(false)
  })

  it('allows loopback (127.0.0.1 / localhost / [::1]) on any port without registration', async () => {
    expect(await isRedirectAllowed('', 'http://127.0.0.1:49152/callback')).toBe(true)
    expect(await isRedirectAllowed('', 'http://localhost:8080/cb')).toBe(true)
    expect(await isRedirectAllowed('', 'http://[::1]:3000/cb')).toBe(true)
  })

  it('does NOT treat a non-loopback http origin as loopback', async () => {
    expect(await isRedirectAllowed('', 'http://attacker.test/cb')).toBe(false)
    // a host merely containing "localhost" is not loopback
    expect(await isRedirectAllowed('', 'http://localhost.evil.test/cb')).toBe(false)
  })
})
