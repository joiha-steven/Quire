// Lean media read for the PUBLIC post/page render: only the columns it needs — variants
// (decides <picture> eligibility) + width/height (reserve image boxes for no CLS). Avoids
// a `select('*')` over the whole media library on every prerendered post render (which is
// what `getMedia` in media.ts does, for the admin library). Cached like the other reads.
import { cache } from 'react'
import { db, liveOnly } from '@/lib/db'
import { expandBlob } from '@/lib/blob'

export type MediaRef = { url: string; variants: boolean; width?: number; height?: number }
type Row = { path: string; variants: boolean; width: number | null; height: number | null }

export const getMediaRefs = cache(async (): Promise<MediaRef[]> => {
  const { data, error } = await liveOnly(db().from('media').select('path, variants, width, height'))
  if (error || !data) {
    if (error) console.error(`[ERROR] media-refs.getMediaRefs: ${error.message}`)
    return []
  }
  return (data as Row[]).map((r) => ({
    url: expandBlob(r.path),
    variants: r.variants,
    width: r.width ?? undefined,
    height: r.height ?? undefined,
  }))
})
