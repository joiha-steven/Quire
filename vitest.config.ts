import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Minimal vitest setup for the offline seam tests.
// - `@` alias mirrors tsconfig paths (avoids a vite-tsconfig-paths dependency).
// - A FAKE Blob token lets blob.ts derive a deterministic store host so the
//   collapse/expand round-trip is checkable without real env / network.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    env: { BLOB_READ_WRITE_TOKEN: 'vercel_blob_rw_teststore_secretabc' },
  },
})
