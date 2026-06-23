// Optional comment-feature secrets (Turnstile + Facebook) — SERVER-ONLY, like
// backup-state. The owner enters these in Admin → Settings; they live in the
// `integration_keys` table (single row id=1), NEVER in settings.data / the client
// payload. An env var of the same name still works as a fallback (DB wins). Never
// import this from a client component.

import { revalidateTag } from 'next/cache'
import { db, DB_TAG } from '@/lib/db'

export type IntegrationKeys = {
  turnstileSiteKey: string // PUBLIC (rendered in the widget)
  turnstileSecretKey: string // secret
  facebookId: string // public-ish (app id)
  facebookSecret: string // secret
}

// What the admin UI may see: which keys are set + the PUBLIC Turnstile site key.
// Secrets themselves are never sent back.
export type IntegrationStatus = {
  turnstileConfigured: boolean
  turnstileSiteKey: string
  facebookConfigured: boolean
}

type Row = {
  turnstile_site_key: string | null
  turnstile_secret_key: string | null
  facebook_id: string | null
  facebook_secret: string | null
}

const env = (k: string) => process.env[k] ?? ''

// Resolve each key: stored value wins, else the same-named env var (back-compat).
export async function getIntegrationKeys(): Promise<IntegrationKeys> {
  let row: Row | null = null
  try {
    const { data } = await db()
      .from('integration_keys')
      .select('turnstile_site_key,turnstile_secret_key,facebook_id,facebook_secret')
      .eq('id', 1)
      .maybeSingle()
    row = (data as Row) ?? null
  } catch (error) {
    console.error(`[ERROR] integration-keys.getIntegrationKeys: ${(error as Error).message}`)
  }
  return {
    turnstileSiteKey: row?.turnstile_site_key || env('TURNSTILE_SITE_KEY'),
    turnstileSecretKey: row?.turnstile_secret_key || env('TURNSTILE_SECRET_KEY'),
    facebookId: row?.facebook_id || env('AUTH_FACEBOOK_ID'),
    facebookSecret: row?.facebook_secret || env('AUTH_FACEBOOK_SECRET'),
  }
}

// Client-safe view: configured flags + the public site key, never the secrets.
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
  const k = await getIntegrationKeys()
  return {
    turnstileConfigured: !!k.turnstileSecretKey,
    turnstileSiteKey: k.turnstileSiteKey,
    facebookConfigured: !!(k.facebookId && k.facebookSecret),
  }
}

// Save provided keys. `undefined` leaves a field untouched; '' clears it (back to
// the env fallback, if any). Trims input.
export async function saveIntegrationKeys(input: Partial<IntegrationKeys>): Promise<void> {
  const patch: Record<string, string | null> = {}
  const map: [keyof IntegrationKeys, keyof Row][] = [
    ['turnstileSiteKey', 'turnstile_site_key'],
    ['turnstileSecretKey', 'turnstile_secret_key'],
    ['facebookId', 'facebook_id'],
    ['facebookSecret', 'facebook_secret'],
  ]
  for (const [k, col] of map) {
    const v = input[k]
    if (v !== undefined) patch[col] = v.trim() || null
  }
  await db().from('integration_keys').upsert({ ...patch, id: 1 })
  revalidateTag(DB_TAG, 'max')
}
