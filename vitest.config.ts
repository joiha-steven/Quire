import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Minimal vitest setup for the offline seam tests.
// - `@` alias mirrors tsconfig paths (avoids a vite-tsconfig-paths dependency).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    // Only the source tree: `output: 'standalone'` copies test files into
    // `.next/standalone`, which vitest would otherwise pick up and fail to resolve.
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
