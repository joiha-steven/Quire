import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the data layer: ensureSlugFree queries posts + pages directly via db().
// Each call chains .from(table).select('slug').eq('slug', slug).maybeSingle().
const hits: { posts: { slug: string } | null; pages: { slug: string } | null } = {
  posts: null,
  pages: null,
}

vi.mock('@/lib/db', () => ({
  DB_TAG: 'db',
  db: () => ({
    from: (table: 'posts' | 'pages') => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => Promise.resolve({ data: hits[table] }),
        }),
      }),
    }),
  }),
}))

import { ensureSlugFree, SlugConflictError } from '@/lib/slugs'

beforeEach(() => {
  hits.posts = null
  hits.pages = null
})

describe('ensureSlugFree (posts + pages share one /{slug} namespace)', () => {
  it('throws SlugConflictError when a post already owns the slug', async () => {
    hits.posts = { slug: 'hello' }
    await expect(ensureSlugFree('hello', 'post')).rejects.toBeInstanceOf(SlugConflictError)
  })

  it('throws when a PAGE owns the slug a new post wants (cross-table)', async () => {
    hits.pages = { slug: 'about' }
    await expect(ensureSlugFree('about', 'post')).rejects.toBeInstanceOf(SlugConflictError)
  })

  it('resolves when the slug is free in both tables', async () => {
    await expect(ensureSlugFree('brand-new', 'post')).resolves.toBeUndefined()
  })

  it('lets an item re-save its own slug (self-match by kind + slug)', async () => {
    hits.posts = { slug: 'hello' }
    await expect(ensureSlugFree('hello', 'post', 'hello')).resolves.toBeUndefined()
  })

  it('a page keeping its own slug still conflicts with a post of the same slug', async () => {
    hits.posts = { slug: 'shared' } // a post owns it
    hits.pages = { slug: 'shared' } // this very page owns it too
    // Editing the page (self = page/shared) must still fail on the POST collision.
    await expect(ensureSlugFree('shared', 'page', 'shared')).rejects.toBeInstanceOf(
      SlugConflictError,
    )
  })
})
