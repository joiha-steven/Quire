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
function dbFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  if (method === 'GET' || method === 'HEAD') {
    return fetch(input, { ...init, next: { revalidate: REVALIDATE, tags: [DB_TAG] } })
  }
  return fetch(input, { ...init, cache: 'no-store' })
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
