// One-off/idempotent repair: downscale any stored media original wider than 2048px
// to 2048px IN PLACE, keeping its format, and update the row's width/height/size.
// App uploads already cap on the way in (lib/image.ts capOriginal); this brings the
// pre-existing library up to the same ceiling so no full-size bytes are ever served.
//
//   node --env-file=.env.local scripts/cap-originals.mjs [--dry]
//
// Talks to PostgREST directly (respecting POSTGREST_DIRECT, like lib/db.ts) and reads
// binaries straight off STORAGE_LOCAL_DIR (like blob-local.ts). --dry: preview only.

import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'

const DRY = process.argv.includes('--dry')
const CAP = 2048

const URL_BASE = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
const DIR = path.resolve(process.env.STORAGE_LOCAL_DIR || './uploads')
// Same rule as lib/db.ts: a bare PostgREST (native) has no /rest/v1 prefix.
const REST = process.env.POSTGREST_DIRECT ? URL_BASE : `${URL_BASE}/rest/v1`
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function pg(pathAndQuery, init = {}) {
  const res = await fetch(`${REST}${pathAndQuery}`, { ...init, headers: { ...HEADERS, ...(init.headers || {}) } })
  if (!res.ok) throw new Error(`PostgREST ${res.status}: ${await res.text()}`)
  return res
}

// Same format map as capOriginal: only these are safely downscalable.
function encoder(pipe, ext) {
  if (ext === 'png') return pipe.png()
  if (ext === 'webp') return pipe.webp({ quality: 82 })
  if (ext === 'avif') return pipe.avif({ quality: 55 })
  if (ext === 'jpg' || ext === 'jpeg') return pipe.jpeg({ quality: 85 })
  return null // svg/gif/other → not cappable
}

const rows = await (await pg('/media?select=path,width,height,size&deleted_at=is.null&width=gt.2048')).json()
console.log(`originals over ${CAP}px: ${rows.length}${DRY ? ' (dry run)' : ''}`)

let changed = 0
for (const row of rows) {
  const ext = row.path.split('.').pop()?.toLowerCase() ?? ''
  const abs = path.resolve(DIR, row.path)
  let buf
  try {
    buf = await fs.readFile(abs)
  } catch {
    console.log(`  SKIP (missing on disk): ${row.path}`)
    continue
  }
  const pipe = encoder(sharp(buf, { failOn: 'none' }).rotate().resize({ width: CAP }), ext)
  if (!pipe) {
    console.log(`  SKIP (not cappable): ${row.path}`)
    continue
  }
  const out = await pipe.toBuffer()
  const meta = await sharp(out).metadata()
  console.log(`  ${row.path}: ${row.width}px/${Math.round(row.size / 1024)}KB -> ${meta.width}px/${Math.round(out.byteLength / 1024)}KB`)
  if (!DRY) {
    await fs.writeFile(abs, out)
    await pg(`/media?path=eq.${encodeURIComponent(row.path)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ width: meta.width ?? null, height: meta.height ?? null, size: out.byteLength }),
    })
  }
  changed++
}
console.log(DRY ? `would cap ${changed}` : `capped ${changed}`)
