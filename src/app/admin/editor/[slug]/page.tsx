// Edit an existing post.
import { notFound } from 'next/navigation'
import { getPost, getCategories, getTags } from '@/lib/posts'
import { PostForm } from '@/components/admin/PostForm'

export const dynamic = 'force-dynamic'

export default async function EditPostPage({ params }: PageProps<'/admin/editor/[slug]'>) {
  const { slug } = await params
  const [post, allCategories, allTags] = await Promise.all([
    getPost(slug),
    getCategories(),
    getTags(),
  ])
  if (!post) notFound()
  return <PostForm initial={post} allCategories={allCategories} allTags={allTags} />
}
