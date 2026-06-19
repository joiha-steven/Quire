// Posts filtered by tag.
import { getPublicPosts } from '@/lib/posts'
import { PostList } from '@/components/blog/PostList'

export const dynamic = 'force-dynamic'

export default async function TagPage({ params }: PageProps<'/tag/[slug]'>) {
  const { slug } = await params
  const name = decodeURIComponent(slug)
  const posts = (await getPublicPosts()).filter((p) => p.tags.includes(name))
  return (
    <section>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">Thẻ: #{name}</h1>
      <PostList posts={posts} emptyText="Chưa có bài viết với thẻ này." />
    </section>
  )
}
