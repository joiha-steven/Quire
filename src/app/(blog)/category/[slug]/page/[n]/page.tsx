// Category pagination: /category/[slug]/page/2, … (page 1 lives at /category/[slug]).
import { notFound } from 'next/navigation'
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { parsePathPage } from '@/lib/paginate'

export default async function CategoryPaged({ params }: PageProps<'/category/[slug]/page/[n]'>) {
  const { slug, n } = await params
  const page = parsePathPage(n)
  if (page === null) notFound()
  const name = decodeURIComponent(slug)
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  const filtered = posts.filter((p) => p.categories.includes(name))

  return (
    <section>
      <BlogListing
        posts={filtered}
        page={page}
        basePath={`/category/${slug}`}
        emptyText={t(language).emptyCategory}
        heading={<h1 className="mb-8 text-2xl font-bold tracking-tight">{t(language).categoryLabel}: {name}</h1>}
      />
    </section>
  )
}
