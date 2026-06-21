// Slug uniqueness across the shared public URL namespace.
// Posts and pages both live at /{slug}, so a slug may belong to at most one of
// them. Queries the tables directly (not via lib/posts|pages) to avoid a
// circular import.
import { db } from '@/lib/db'

// Thrown by save* when a slug is already taken by a different post/page.
// API routes map this to a 409 with the `slug_taken` error code.
export class SlugConflictError extends Error {
  constructor(slug: string) {
    super(`slug_taken: ${slug}`)
    this.name = 'SlugConflictError'
  }
}

// Throw SlugConflictError if `slug` is used by any post/page other than the item
// being saved (identified by `selfKind` + `selfSlug`).
export async function ensureSlugFree(
  slug: string,
  selfKind: 'post' | 'page',
  selfSlug?: string,
): Promise<void> {
  const [{ data: post }, { data: page }] = await Promise.all([
    db().from('posts').select('slug').eq('slug', slug).maybeSingle(),
    db().from('pages').select('slug').eq('slug', slug).maybeSingle(),
  ])
  const postHit = !!post && !(selfKind === 'post' && post.slug === selfSlug)
  const pageHit = !!page && !(selfKind === 'page' && page.slug === selfSlug)
  if (postHit || pageHit) throw new SlugConflictError(slug)
}
