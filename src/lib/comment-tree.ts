// Pure helper for the optimistic comment overlay. The Comments island shows a
// just-posted comment immediately, then an authoritative refetch replaces it.
// This merges the pending comments onto the fetched tree for that brief window:
// top-level pending append to the list; replies append to their parent's replies.
// Drift-free because the refetch (same renderer) then clears the overlay.
import type { PublicComment } from '@/types'

export function mergeOptimisticComments(tree: PublicComment[], pending: PublicComment[]): PublicComment[] {
  if (!pending.length) return tree
  const tops = pending.filter((p) => p.parentId == null)
  const childrenOf = (id: number) => pending.filter((p) => p.parentId === id)
  const walk = (nodes: PublicComment[]): PublicComment[] =>
    nodes.map((n) => ({ ...n, replies: walk(n.replies).concat(childrenOf(n.id)) }))
  return walk(tree).concat(tops)
}
