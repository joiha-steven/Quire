// One-off/idempotent repair: downscale any stored media original wider than 2048px
// to 2048px IN PLACE, keeping its format, and update the row's width/height/size.
// App uploads already cap on the way in (lib/image.ts capOriginal); this brings the
// pre-existing library up to the same ceiling so no full-size bytes are ever served.
//
//   node --env-file=.env.local scripts/cap-originals.mjs [--dry]
//
// Reads binaries straight off STORAGE_LOCAL_DIR (same as blob-local.ts). --dry: preview.

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import path from 'node:path'
import fs from 'node:fs/promises'

const DRY = process.argv.includes('--dry')
const CAP = 2048

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
const DIR = path.resolve(process.env.STORAGE_LOCAL_DIR || './uploads')

const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Same format map as capOriginal: only these are safely downscalable.
function encoder(pipe, ext) {
  if (ext === 'png') return pipe.png()
  if (ext === 'webp') return pipe.webp({ quality: 82 })
  if (ext === 'avif') return pipe.avif({ quality: 55 })
  if (ext === 'jpg' || ext === 'jpeg') return pipe.jpeg({ quality: 85 })
  return null // svg/gif/other → not cappable
}

const { data, error } = await db.from('media').select('path, width, height, size').is('deleted_at', null).gt('width', CAP)
if (error) throw new Error(error.message)
console.log(`originals over ${CAP}px: ${data.length}${DRY ? ' (dry run)' : ''}`)

let changed = 0
for (const row of data) {
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
    const { error: e } = await db
      .from('media')
      .update({ width: meta.width ?? null, height: meta.height ?? null, size: out.byteLength })
      .eq('path', row.path)
    if (e) throw new Error(`${row.path}: ${e.message}`)
  }
  changed++
}
console.log(DRY ? `would cap ${changed}` : `capped ${changed}`)
