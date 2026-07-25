// PostgREST client — the data layer's storage for ALL text content (posts, pages,
// revisions, media/file metadata, settings). Binaries (images, attachments, icons)
// live on the local filesystem; see `blob.ts`.
//
// SERVER-ONLY. Uses the secret service_role token, which bypasses RLS. Every admin
// write is already owner-gated by next-auth (`requireOwner`) and public reads only
// select published rows, so it is safe to centralize trust on the server here.
// The token must NEVER reach the client — do not import this from a client component.
//
// `@supabase/postgrest-js` is the standalone PostgREST client (the query builder that
// `supabase-js` wraps). Quire self-hosts Postgres + PostgREST and uses no other
// Supabase service, so it depends on this package directly rather than dragging in
// supabase-js's auth/realtime/storage/functions clients, which it never calls.

import { PostgrestClient } from '@supabase/postgrest-js'

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

function dbFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return fetch(input, { ...init, next: { revalidate: REVALIDATE, tags: [DB_TAG] } })
  }
  return fetch(input, { ...init, cache: 'no-store' })
}

let _client: PostgrestClient | undefined

// Lazy singleton: built on first use so a missing env var fails at call time
// (degrade-friendly) rather than at module load, matching blob.ts's behavior.
//
// POSTGREST_URL is the endpoint that serves tables at `/<table>` — a bundled or your
// own PostgREST. (Behind Supabase's gateway that path is `/rest/v1`, so such a URL
// includes the prefix; nothing here special-cases it.)
export function db(): PostgrestClient {
  if (_client) return _client
  const url = process.env.POSTGREST_URL
  const token = process.env.POSTGREST_TOKEN
  if (!url || !token) {
    throw new Error('Missing POSTGREST_URL or POSTGREST_TOKEN')
  }
  _client = new PostgrestClient(url, {
    headers: { apikey: token, authorization: `Bearer ${token}` },
    fetch: dbFetch,
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
