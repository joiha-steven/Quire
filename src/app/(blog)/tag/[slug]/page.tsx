// Posts filtered by tag.
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { PostList } from '@/components/blog/PostList'

export const dynamic = 'force-dynamic'

export default async function TagPage({ params }: PageProps<'/tag/[slug]'>) {
  const { slug } = await params
  const name = decodeURIComponent(slug)
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  const filtered = posts.filter((p) => p.tags.includes(name))
  return (
    <section>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">
        {t(language).tagLabel}: #{name}
      </h1>
      <PostList posts={filtered} lang={language} emptyText={t(language).emptyTag} />
    </section>
  )
}
