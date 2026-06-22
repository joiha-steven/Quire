import { describe, it, expect, beforeEach, vi } from 'vitest'

// Invariant 6: every LIVE read filters `.is('deleted_at', null)`. A read path that
// forgets it leaks trashed content to the public — silently (no build/test error).
//
// The mock db() builder ACTUALLY applies the .eq/.is filters the code chains, over
// a seeded dataset of [one live row, one trashed row]. So if a read path drops its
// `.is('deleted_at', null)`, the trashed row stops being filtered and these tests
// fail — that is the leak guard. (textSearch/select/order/limit are accepted no-ops.)
type Row = Record<string, unknown>
const state = vi.hoisted(() => ({ posts: [] as Record<string, unknown>[] }))

vi.mock('@/lib/db', () => {
  type Resolve = (v: { data: Row[]; error: null }) => unknown
  type Query = {
    select: () => Query
    order: () => Query
    limit: () => Query
    textSearch: () => Query
    eq: (col: string, val: unknown) => Query
    is: (col: string, val: unknown) => Query
    maybeSingle: () => Promise<{ data: Row | null; error: null }>
    then: (resolve: Resolve) => unknown
  }
  const makeBuilder = (rows: Row[]): Query => {
    const filters: ((r: Row) => boolean)[] = []
    const result = () => rows.filter((r) => filters.every((f) => f(r)))
    const q: Query = {
      select: () => q,
      order: () => q,
      limit: () => q,
      textSearch: () => q,
      eq: (col, val) => { filters.push((r) => r[col] === val); return q },
      is: (col, val) => { filters.push((r) => (val === null ? r[col] == null : r[col] === val)); return q },
      maybeSingle: () => Promise.resolve({ data: result()[0] ?? null, error: null }),
      then: (resolve) => resolve({ data: result(), error: null }),
    }
    return q
  }
  return { DB_TAG: 'db', db: () => ({ from: () => makeBuilder(state.posts) }) }
})

import { getIndex, getPublicPosts, searchPosts, getPost } from '@/lib/posts'

const LIVE: Row = {
  slug: 'live-post', title: 'Live', date: '2020-01-01', status: 'published',
  categories: [], tags: [], featured_image: null, excerpt: null,
  reading_minutes: 1, content: 'body', deleted_at: null,
}
const TRASHED: Row = { ...LIVE, slug: 'trashed-post', title: 'Trashed', deleted_at: '2026-01-01T00:00:00Z' }

beforeEach(() => {
  state.posts = [LIVE, TRASHED]
})

describe('soft delete: trashed posts never leak to a live read', () => {
  it('the listing (getIndex) excludes a trashed post', async () => {
    const list = await getIndex()
    expect(list.map((p) => p.slug)).toEqual(['live-post'])
  })

  it('the public listing (getPublicPosts) excludes a trashed post', async () => {
    const list = await getPublicPosts()
    expect(list.map((p) => p.slug)).toEqual(['live-post'])
  })

  it('search (searchPosts) excludes a trashed post', async () => {
    const hits = await searchPosts('anything')
    expect(hits.map((p) => p.slug)).toEqual(['live-post'])
  })

  it('the single read (getPost) returns null for a trashed slug', async () => {
    expect(await getPost('trashed-post')).toBeNull()
  })

  it('the single read (getPost) still returns a live post', async () => {
    const post = await getPost('live-post')
    expect(post?.slug).toBe('live-post')
  })
})
