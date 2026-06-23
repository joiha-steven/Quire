import { describe, it, expect } from 'vitest'
import { mergeOptimisticComments } from '@/lib/comment-tree'
import type { PublicComment } from '@/types'

const node = (id: number, parentId: number | null, replies: PublicComment[] = []): PublicComment => ({
  id,
  parentId,
  name: `c${id}`,
  provider: 'manual',
  contentHtml: `<p>${id}</p>`,
  createdAt: '2026-01-01T00:00:00Z',
  deleted: false,
  replies,
})

describe('mergeOptimisticComments', () => {
  it('returns the tree unchanged when nothing is pending', () => {
    const tree = [node(1, null)]
    expect(mergeOptimisticComments(tree, [])).toBe(tree)
  })

  it('appends a top-level pending comment to the end of the list', () => {
    const tree = [node(1, null)]
    const out = mergeOptimisticComments(tree, [node(-1, null)])
    expect(out.map((c) => c.id)).toEqual([1, -1])
  })

  it('appends a pending reply to its parent’s replies (nested)', () => {
    const tree = [node(1, null, [node(2, 1)])]
    const out = mergeOptimisticComments(tree, [node(-1, 2)])
    expect(out[0].replies[0].replies.map((c) => c.id)).toEqual([-1])
  })

  it('does not mutate the input tree', () => {
    const tree = [node(1, null)]
    mergeOptimisticComments(tree, [node(-1, 1)])
    expect(tree[0].replies).toEqual([])
  })
})
