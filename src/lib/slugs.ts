// Slug uniqueness across the shared public URL namespace.
// Posts and pages both live at /{slug}, so a slug may belong to at most one of
// them. Reads the raw manifests directly (not via lib/posts|pages) to avoid a
// circular import.
import type { Post, Page } from '@/types'
import { readJson } from '@/lib/blob'

const POSTS_INDEX = 'posts/_index.json'
const PAGES_INDEX = 'pages/_index.json'

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
  const [posts, pages] = await Promise.all([
    readJson<Post[]>(POSTS_INDEX, []),
    readJson<Page[]>(PAGES_INDEX, []),
  ])
  const postHit = posts.some((p) => p.slug === slug && !(selfKind === 'post' && p.slug === selfSlug))
  const pageHit = pages.some((p) => p.slug === slug && !(selfKind === 'page' && p.slug === selfSlug))
  if (postHit || pageHit) throw new SlugConflictError(slug)
}
