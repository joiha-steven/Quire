// Edit an existing post.
import { notFound } from 'next/navigation'
import { getPost, getCategories, getTags } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { PostForm } from '@/components/admin/PostForm'


export default async function EditPostPage({ params }: PageProps<'/admin/editor/[slug]'>) {
  const { slug } = await params
  const [post, allCategories, allTags, settings] = await Promise.all([
    getPost(slug),
    getCategories(),
    getTags(),
    getSettings(),
  ])
  if (!post) notFound()
  return <PostForm initial={post} allCategories={allCategories} allTags={allTags} contentWidth={settings.contentWidth} typewriterEffects={settings.motion.typewriter} />
}
