// Posts filtered by category, first page. Deeper pages: /category/[slug]/page/[n].
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'

export const dynamic = 'force-dynamic'

export default async function CategoryPage({ params }: PageProps<'/category/[slug]'>) {
  const { slug } = await params
  const name = decodeURIComponent(slug)
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  const filtered = posts.filter((p) => p.categories.includes(name))

  return (
    <section>
      <BlogListing
        posts={filtered}
        page={1}
        basePath={`/category/${slug}`}
        emptyText={t(language).emptyCategory}
        heading={<h1 className="mb-8 text-2xl font-bold tracking-tight">{t(language).categoryLabel}: {name}</h1>}
      />
    </section>
  )
}
