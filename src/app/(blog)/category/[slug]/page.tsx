// Posts filtered by category.
import { getPublicPosts } from '@/lib/posts'
import { PostList } from '@/components/blog/PostList'

export const dynamic = 'force-dynamic'

export default async function CategoryPage({ params }: PageProps<'/category/[slug]'>) {
  const { slug } = await params
  const name = decodeURIComponent(slug)
  const posts = (await getPublicPosts()).filter((p) => p.categories.includes(name))
  return (
    <section>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">Danh mục: {name}</h1>
      <PostList posts={posts} emptyText="Chưa có bài viết trong danh mục này." />
    </section>
  )
}
