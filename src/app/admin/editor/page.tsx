// New post.
import { getCategories, getTags } from '@/lib/posts'
import { PostForm } from '@/components/admin/PostForm'

export const dynamic = 'force-dynamic'

export default async function NewPostPage() {
  const [allCategories, allTags] = await Promise.all([getCategories(), getTags()])
  return <PostForm allCategories={allCategories} allTags={allTags} />
}
