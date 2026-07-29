// Boot. Opens the databases, builds the router, listens.
//
// Order matters and is the reason this file is separate from `web/app.ts`: `db()` throws
// if it is called before `openDatabases`, so the failure mode of getting this wrong is a
// clear error at startup rather than a confusing one on the first request.

import { readEnv } from '@/env'
import { openDatabases, closeDatabases } from '@/store/db'
import { ensureBlobStore } from '@/media/blob-local'
import { flushAnalytics, resetAnalyticsBuffer } from '@/analytics/buffer'
import { createApp } from '@/web/app'
import { enableBackgroundCache } from '@/server/warm'

const env = readEnv()
openDatabases(env.dataDir)
// Same reason `openDatabases` creates its directory: a fresh install should come up
// healthy, not report degraded storage until somebody uploads a file.
ensureBlobStore()

const app = createApp()

const server = Bun.serve({ port: env.port, fetch: app.fetch })
console.log(`quire 2.0 listening on http://127.0.0.1:${server.port}`)

// Re-fill the page cache after any write, and purge the CDN behind it. Registered HERE
// rather than inside `clearCache()` so that a test suite, a script or an import job gets a
// plain Map.clear() and nothing else.
enableBackgroundCache()

// Analytics buffers in memory (Invariant 7), so a shutdown that skips this loses the
// pageviews recorded since the last flush. Two seconds of them, but there is no reason to.
function shutdown(signal: string): void {
  console.log(`\n${signal}: flushing and closing`)
  try {
    flushAnalytics()
  } finally {
    resetAnalyticsBuffer()
    closeDatabases()
    process.exit(0)
  }
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
