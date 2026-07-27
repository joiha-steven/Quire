// Optional integration secrets (Turnstile comment anti-spam + Cloudflare cache
// purge) — SERVER-ONLY, like backup-state. The owner enters these in Admin →
// Settings; they live in the `integration_keys` table (single row id=1), NEVER in
// settings.data / the client payload. An env var of the same name still works as a
// fallback (DB wins). Never import this from a client-bound payload.

import { clearCache } from '@/server/cache'
import { one, run } from '@/store/query'

export type IntegrationKeys = {
  turnstileSiteKey: string // PUBLIC (rendered in the widget)
  turnstileSecretKey: string // secret
  cloudflareApiToken: string // secret — Zone.Cache Purge token
  cloudflareZoneId: string // not secret — the zone to purge
}

// What the admin UI may see: which secrets are set + the PUBLIC values (Turnstile
// site key, Cloudflare zone id). Secrets themselves are never sent back.
export type IntegrationStatus = {
  turnstileConfigured: boolean
  turnstileSiteKey: string
  cloudflareConfigured: boolean
  cloudflareZoneId: string
}

type Row = {
  turnstile_site_key: string | null
  turnstile_secret_key: string | null
  cloudflare_api_token: string | null
  cloudflare_zone_id: string | null
}

const env = (k: string) => process.env[k] ?? ''

function readRow(): Row | null {
  return one<Row>(
    `select turnstile_site_key, turnstile_secret_key, cloudflare_api_token, cloudflare_zone_id
       from integration_keys where id = 1`,
  )
}

// Resolve each key: stored value wins, else the same-named env var (back-compat).
export async function getIntegrationKeys(): Promise<IntegrationKeys> {
  let row: Row | null = null
  try {
    row = readRow()
  } catch (error) {
    console.error(`[ERROR] integration-keys.getIntegrationKeys: ${(error as Error).message}`)
  }
  return {
    turnstileSiteKey: row?.turnstile_site_key || env('TURNSTILE_SITE_KEY'),
    turnstileSecretKey: row?.turnstile_secret_key || env('TURNSTILE_SECRET_KEY'),
    cloudflareApiToken: row?.cloudflare_api_token || env('CLOUDFLARE_API_TOKEN'),
    cloudflareZoneId: row?.cloudflare_zone_id || env('CLOUDFLARE_ZONE_ID'),
  }
}

// Client-safe view: configured flags + the public values, never the secrets.
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const k = await getIntegrationKeys()
  return {
    turnstileConfigured: !!k.turnstileSecretKey,
    turnstileSiteKey: k.turnstileSiteKey,
    cloudflareConfigured: !!(k.cloudflareApiToken && k.cloudflareZoneId),
    cloudflareZoneId: k.cloudflareZoneId,
  }
}

// Save provided keys. `undefined` leaves a field untouched; '' clears it (back to
// the env fallback, if any). Trims input.
//
// PostgREST's upsert took a partial payload and updated exactly those columns. SQLite has
// no partial upsert without assembling the SET clause from the payload, and assembling SQL
// is the one thing this codebase does not do. So the merge happens here and the statement
// stays a literal that writes all four columns. Read-modify-write is safe for the same
// reason it was in the frozen tree: one owner, one settings form, no other writer.
export async function saveIntegrationKeys(input: Partial<IntegrationKeys>): Promise<void> {
  const current = readRow()
  const pick = (next: string | undefined, stored: string | null | undefined): string | null =>
    next === undefined ? (stored ?? null) : next.trim() || null

  run(
    `insert into integration_keys (id, turnstile_site_key, turnstile_secret_key,
                                   cloudflare_api_token, cloudflare_zone_id)
     values (1, $siteKey, $secretKey, $apiToken, $zoneId)
     on conflict(id) do update set
       turnstile_site_key   = excluded.turnstile_site_key,
       turnstile_secret_key = excluded.turnstile_secret_key,
       cloudflare_api_token = excluded.cloudflare_api_token,
       cloudflare_zone_id   = excluded.cloudflare_zone_id`,
    {
      siteKey: pick(input.turnstileSiteKey, current?.turnstile_site_key),
      secretKey: pick(input.turnstileSecretKey, current?.turnstile_secret_key),
      apiToken: pick(input.cloudflareApiToken, current?.cloudflare_api_token),
      zoneId: pick(input.cloudflareZoneId, current?.cloudflare_zone_id),
    },
  )
  clearCache()
}
