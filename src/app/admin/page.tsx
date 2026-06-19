// Dashboard: list all posts (any status).
import { getIndex } from '@/lib/posts'
import { PostsTable } from '@/components/admin/PostsTable'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const posts = await getIndex()
  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight">Bảng điều khiển</h1>
      <PostsTable initialPosts={posts} />
    </div>
  )
}
