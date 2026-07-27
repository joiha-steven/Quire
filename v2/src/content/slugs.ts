// Slug uniqueness across the shared public URL namespace.
// Posts and pages both live at /{slug}, so a slug may belong to at most one of
// them. Queries the tables directly (not via content/posts|pages) to avoid a
// circular import.
import { one } from '@/store/query'

// Thrown by save* when a slug is already taken by a different post/page.
// Route handlers map this to a 409 with the `slug_taken` error code.
export class SlugConflictError extends Error {
  constructor(slug: string) {
    super(`slug_taken: ${slug}`)
    this.name = 'SlugConflictError'
  }
}

// Throw SlugConflictError if `slug` is used by any post/page other than the item
// being saved (identified by `selfKind` + `selfSlug`).
//
// The check deliberately ignores `deleted_at`: a trashed row keeps its slug reserved so
// that restoring it always works. That was true of the frozen tree too, because this
// never went through `liveOnly`.
export async function ensureSlugFree(
  slug: string,
  selfKind: 'post' | 'page',
  selfSlug?: string,
): Promise<void> {
  const post = one<{ slug: string }>(`select slug from posts where slug = ?`, slug)
  const page = one<{ slug: string }>(`select slug from pages where slug = ?`, slug)
  const postHit = !!post && !(selfKind === 'post' && post.slug === selfSlug)
  const pageHit = !!page && !(selfKind === 'page' && page.slug === selfSlug)
  if (postHit || pageHit) throw new SlugConflictError(slug)
}
