// Home: list of published posts, newest first.
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { PostList } from '@/components/blog/PostList'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  return <PostList posts={posts} lang={language} emptyText={t(language).emptyPosts} />
}
