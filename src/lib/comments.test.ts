import { describe, it, expect, vi } from 'vitest'

// Mock the data layer so addComment's parent lookup is controllable. `liveOnly`
// is a pass-through; `insert` returns a minimal row (only reached on success).
const hoisted = vi.hoisted(() => ({
  parent: null as { post_slug: string; depth: number; deleted_at: string | null } | null,
}))
vi.mock('@/lib/db', () => ({
  liveOnly: <T>(q: T): T => q,
  db: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: hoisted.parent }) }) }),
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { id: 9, parent_id: 1, author_name: 'x', author_website: null, provider: 'manual', content: 'c', created_at: 't', deleted_at: null },
            }),
        }),
      }),
    }),
  }),
}))

import { buildCommentTree, addComment, CommentInputError, type CommentRow } from '@/lib/comments'

// Build a row with sane defaults; override what each case needs.
function row(p: Partial<CommentRow> & { id: number }): CommentRow {
  return {
    id: p.id,
    post_slug: p.post_slug ?? 'hello',
    parent_id: p.parent_id ?? null,
    depth: p.depth ?? 0,
    author_name: p.author_name ?? `u${p.id}`,
    author_website: p.author_website ?? null,
    provider: p.provider ?? 'manual',
    content: p.content ?? `c${p.id}`,
    created_at: p.created_at ?? '2026-01-01T00:00:00Z',
    deleted_at: p.deleted_at ?? null,
  }
}

describe('buildCommentTree', () => {
  it('nests replies under their parent', () => {
    const tree = buildCommentTree([
      row({ id: 1 }),
      row({ id: 2, parent_id: 1, depth: 1 }),
      row({ id: 3, parent_id: 2, depth: 2 }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].replies[0].id).toBe(2)
    expect(tree[0].replies[0].replies[0].id).toBe(3)
  })

  it('renders content as limited markdown, never exposes email', () => {
    const tree = buildCommentTree([row({ id: 1, content: 'hi **there**' })])
    expect(tree[0].contentHtml).toBe('hi <strong>there</strong>')
    expect(tree[0]).not.toHaveProperty('email')
  })

  it('prunes a deleted comment that has no replies', () => {
    const tree = buildCommentTree([row({ id: 1, deleted_at: '2026-01-02T00:00:00Z' })])
    expect(tree).toHaveLength(0)
  })

  it('tombstones a deleted comment that still has a live reply', () => {
    const tree = buildCommentTree([
      row({ id: 1, deleted_at: '2026-01-02T00:00:00Z', content: 'secret', author_name: 'Alice' }),
      row({ id: 2, parent_id: 1, depth: 1, content: 'still here' }),
    ])
    expect(tree).toHaveLength(1)
    expect(tree[0].deleted).toBe(true)
    expect(tree[0].name).toBe('')
    expect(tree[0].contentHtml).toBe('')
    expect(tree[0].replies[0].contentHtml).toBe('still here')
  })

  it('re-roots an orphan whose parent was purged', () => {
    // id 2 references parent 99 which is not in the set -> treated as a root.
    const tree = buildCommentTree([row({ id: 1 }), row({ id: 2, parent_id: 99, depth: 1 })])
    expect(tree.map((c) => c.id).sort()).toEqual([1, 2])
  })
})

describe('addComment input guards', () => {
  const base = { postSlug: 'hello', name: 'A', email: 'a@b.co', provider: 'manual' as const, content: 'hi' }

  it('rejects a reply past the 3-tier limit with a CommentInputError', async () => {
    hoisted.parent = { post_slug: 'hello', depth: 2, deleted_at: null } // already at the deepest tier
    await expect(addComment({ ...base, parentId: 1 })).rejects.toBeInstanceOf(CommentInputError)
  })

  it('rejects a reply to a missing/deleted parent', async () => {
    hoisted.parent = null
    await expect(addComment({ ...base, parentId: 1 })).rejects.toBeInstanceOf(CommentInputError)
  })

  it('rejects empty content', async () => {
    await expect(addComment({ ...base, parentId: null, content: '   ' })).rejects.toBeInstanceOf(CommentInputError)
  })
})
