// New post.
import { getCategories, getTags } from '@/lib/posts'
import { getAllSeriesNames } from '@/lib/series'
import { getSettings } from '@/lib/settings'
import { PostForm } from '@/components/admin/PostForm'


export default async function NewPostPage() {
  const [allCategories, allTags, allSeries, settings] = await Promise.all([
    getCategories(),
    getTags(),
    getAllSeriesNames(),
    getSettings(),
  ])
  return <PostForm allCategories={allCategories} allTags={allTags} allSeries={allSeries} contentWidth={settings.contentWidth} typewriterEffects={settings.motion.typewriter} />
}
