// Dashboard: list all posts (any status).
import { getIndex } from '@/lib/posts'
import { PostsTable } from '@/components/admin/PostsTable'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const posts = await getIndex()
  return <PostsTable initialPosts={posts} />
}
