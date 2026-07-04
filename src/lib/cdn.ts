// CDN cache purge. The app's own ISR/Data caches self-purge on every write
// (revalidate.ts); a CDN in front (Cloudflare) does NOT know about that, so when the
// owner has configured a Cloudflare token + zone (Admin → Settings → Integrations),
// we also purge the whole zone on every write so an edit is live immediately with no
// manual purge. Best-effort: never throws, logs on failure — a missed purge self-heals
// on the CDN's own TTL / the next write. SERVER-ONLY.

import { getIntegrationKeys } from '@/lib/integration-keys'

// Purge the entire Cloudflare zone. No-op when unconfigured.
export async function purgeCloudflare(): Promise<void> {
  try {
    const { cloudflareApiToken, cloudflareZoneId } = await getIntegrationKeys()
    if (!cloudflareApiToken || !cloudflareZoneId) return
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${cloudflareZoneId}/purge_cache`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cloudflareApiToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ purge_everything: true }),
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      console.error(`[ERROR] cdn.purgeCloudflare: ${res.status} ${(await res.text()).slice(0, 200)}`)
    }
  } catch (error) {
    console.error(`[ERROR] cdn.purgeCloudflare: ${(error as Error).message}`)
  }
}
