// Runtime configuration, read once at boot and validated here rather than at the call
// site. A missing value that only surfaces on the request that needs it is the shape of
// outage the frozen tree's `src/env.ts` existed to prevent, and the reason is unchanged.

export type Env = {
  port: number
  dataDir: string
  /** Canonical origin for absolute URLs (feeds, OG, emails). Empty = derive per request. */
  siteUrl: string
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const port = Number(source.PORT ?? 3000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`env: PORT must be a valid port number, got ${JSON.stringify(source.PORT)}`)
  }
  return {
    port,
    // Both database files live here. One directory, so the server and `import-v1` cannot
    // disagree about where they are.
    dataDir: source.DATA_DIR ?? './data',
    siteUrl: (source.SITE_URL ?? '').replace(/\/+$/, ''),
  }
}
