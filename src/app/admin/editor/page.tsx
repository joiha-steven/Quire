// New post.
import { getCategories, getTags } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { PostForm } from '@/components/admin/PostForm'


export default async function NewPostPage() {
  const [allCategories, allTags, settings] = await Promise.all([getCategories(), getTags(), getSettings()])
  return <PostForm allCategories={allCategories} allTags={allTags} contentWidth={settings.contentWidth} />
}
