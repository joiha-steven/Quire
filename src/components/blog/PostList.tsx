// A list of post previews with an empty state.
import type { Post } from '@/types'
import { PostCard } from './PostCard'

export function PostList({ posts, emptyText = 'Chưa có bài viết nào.' }: { posts: Post[]; emptyText?: string }) {
  if (posts.length === 0) {
    return <p className="py-16 text-center text-neutral-500">{emptyText}</p>
  }
  return (
    <div className="flex flex-col gap-8">
      {posts.map((post) => (
        <PostCard key={post.slug} post={post} />
      ))}
    </div>
  )
}
