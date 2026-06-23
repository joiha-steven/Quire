// Supabase Postgres client — the data layer's storage for ALL text content
// (posts, pages, revisions, media/file metadata, settings). Binaries (images,
// attachments, icons) still live on Vercel Blob; see `blob.ts`.
//
// SERVER-ONLY. Uses the secret service_role key, which bypasses RLS. Every admin
// write is already owner-gated by next-auth (`requireOwner`) and public reads only
// select published rows, so it is safe to centralize trust on the server here.
// The key must NEVER reach the client — do not import this from a client component.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Custom fetch so the data layer plays well with Next's caching:
// - READS (GET) are cache-eligible (`next.revalidate`) so a public page that reads
//   them can still be ISR/statically rendered (a `no-store` read would force the
//   whole route dynamic, killing the page cache). They are tagged `db`, and EVERY
//   admin write calls `revalidateTag('db')` (see revalidate.ts) — so when a purged
//   page re-renders it always reads CURRENT data, never a stale Data Cache entry.
//   The 3600s revalidate is just a safety net. Admin surfaces that must read LIVE
//   (the /admin layout + the owner-only list API routes) set BOTH `dynamic =
//   'force-dynamic'` AND `fetchCache = 'force-no-store'` — force-dynamic ALONE does not
//   de-cache these reads, because they opt into the Data Cache with an explicit
//   `next.revalidate` (Next only auto-de-caches force-dynamic fetches that set none).
// - WRITES (POST/PATCH/DELETE/etc.) are `no-store` — never cached.
export const DB_TAG = 'db'
const REVALIDATE = 3600

// Self-host (Docker) talks to a BUNDLED PostgREST instead of Supabase's gateway.
// supabase-js builds `${SUPABASE_URL}/rest/v1/<table>`; bare PostgREST serves tables
// at `/<table>`, so when POSTGREST_DIRECT=1 we strip the `/rest/v1` prefix here. This
// keeps the whole data layer (and supabase-js) byte-for-byte identical on both
// targets — only the URL path differs. Unset on Vercel → hits Supabase unchanged.
const POSTGREST_DIRECT = process.env.POSTGREST_DIRECT === '1'
function restTarget(input: RequestInfo | URL): RequestInfo | URL {
  if (!POSTGREST_DIRECT) return input
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : null
  return url ? url.replace('/rest/v1', '') : input
}

function dbFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const target = restTarget(input)
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return fetch(target, { ...init, next: { revalidate: REVALIDATE, tags: [DB_TAG] } })
  }
  return fetch(target, { ...init, cache: 'no-store' })
}

let _client: SupabaseClient | undefined

// Lazy singleton: built on first use so a missing env var fails at call time
// (degrade-friendly) rather than at module load, matching blob.ts's behavior.
export function db(): SupabaseClient {
  if (_client) return _client
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }
  _client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: dbFetch },
  })
  return _client
}

// Soft-delete predicate, defined ONCE (Invariant 6). EVERY live read of a
// soft-deletable table (posts/pages/media/files) wraps its query in liveOnly, so
// the column + null check live here and nowhere else — a read can't drift to a
// different filter. Trash views read the complement directly
// (`.not('deleted_at', 'is', null)`); those must NOT use this.
export function liveOnly<Q extends { is(column: 'deleted_at', value: null): Q }>(query: Q): Q {
  return query.is('deleted_at', null)
}
