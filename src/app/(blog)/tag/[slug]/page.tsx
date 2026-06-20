// Posts filtered by tag, first page. Deeper pages: /tag/[slug]/page/[n].
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'

export const dynamic = 'force-dynamic'

export default async function TagPage({ params }: PageProps<'/tag/[slug]'>) {
  const { slug } = await params
  const name = decodeURIComponent(slug)
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  const filtered = posts.filter((p) => p.tags.includes(name))

  return (
    <section>
      <BlogListing
        posts={filtered}
        page={1}
        basePath={`/tag/${slug}`}
        emptyText={t(language).emptyTag}
        heading={<h1 className="mb-8 text-2xl font-bold tracking-tight">{t(language).tagLabel}: #{name}</h1>}
      />
    </section>
  )
}
