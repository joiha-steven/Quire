// Storage-portability gate: keep the Vercel Blob SDK contained so the
// STORAGE_DRIVER switch (vercel-blob vs local filesystem) lives in known places and
// a self-host / Docker build can never silently break by reaching the SDK directly.
//
//   - `@vercel/blob` (server SDK) → ONLY the storage facade src/lib/blob.ts.
//   - `@vercel/blob/client` (browser direct-upload) → ONLY the client-upload files,
//     which already branch on NEXT_PUBLIC_STORAGE_DRIVER and fall back to a
//     server-mediated upload when the driver is local.
import { readFileSync } from 'node:fs'
import { walk, isTs, report } from './_util.mjs'

// pathname (posix) → which import specifier it is allowed to use.
const ALLOW = {
  'src/lib/blob.ts': '@vercel/blob',
  'src/lib/upload-client.ts': '@vercel/blob/client',
  'src/app/api/media/blob-token/route.ts': '@vercel/blob/client',
  'src/app/api/files/blob-token/route.ts': '@vercel/blob/client',
}

const files = walk('src', isTs)
const violations = []

for (const file of files) {
  const key = file.replace(/\\/g, '/')
  const raw = readFileSync(file, 'utf8')
  // Match a static or dynamic import of @vercel/blob or @vercel/blob/client.
  const m = raw.match(/['"](@vercel\/blob(?:\/client)?)['"]/)
  if (!m) continue
  if (ALLOW[key] === m[1]) continue
  violations.push(`${file} — imports ${m[1]} directly (use src/lib/blob.ts or the client-upload path)`)
}

console.log(`  scanned ${files.length} src files`)
process.exit(report('check:no-direct-blob', violations))
