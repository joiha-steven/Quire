// Home: list of published posts, newest first.
import { getPublicPosts } from '@/lib/posts'
import { PostList } from '@/components/blog/PostList'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const posts = await getPublicPosts()
  return <PostList posts={posts} />
}
