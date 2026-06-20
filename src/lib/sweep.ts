// Find and delete media not referenced by any post, page, or settings.
// A manual "clean unused" action for the library — clears orphans left behind
// when an image is dropped then discarded, or removed from a post.

import { getIndex, getPost } from '@/lib/posts'
import { getPageIndex, getPage } from '@/lib/pages'
import { getSettings } from '@/lib/settings'
import { getMedia, deleteMedia } from '@/lib/media'
import { collapseBlob } from '@/lib/blob'

const MEDIA_RE = /media\/[^\s")'#]+/gi

// All store-relative media pathnames referenced anywhere in a piece of text.
function refsIn(text: string | undefined): string[] {
  if (!text) return []
  return [...collapseBlob(text).matchAll(MEDIA_RE)].map((m) => m[0])
}

export async function sweepUnusedMedia(): Promise<{ deleted: number; kept: number }> {
  const used = new Set<string>()
  const add = (text?: string) => refsIn(text).forEach((r) => used.add(r))

  for (const p of await getIndex()) {
    const full = await getPost(p.slug)
    add(full?.content)
    add(full?.featuredImage)
  }
  for (const p of await getPageIndex()) {
    const full = await getPage(p.slug)
    add(full?.content)
    add(full?.featuredImage)
  }
  const s = await getSettings()
  add(s.logoUrl)
  add(s.seo.ogFallbackImage)

  const media = await getMedia()
  let deleted = 0
  for (const m of media) {
    if (!used.has(collapseBlob(m.url))) {
      await deleteMedia(m.url)
      deleted++
    }
  }
  return { deleted, kept: media.length - deleted }
}
