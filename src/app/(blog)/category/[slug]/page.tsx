// Posts filtered by category (paginated).
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { paginate, parsePage } from '@/lib/paginate'
import { PostList } from '@/components/blog/PostList'
import { Pagination } from '@/components/blog/Pagination'


export default async function CategoryPage({ params, searchParams }: PageProps<'/category/[slug]'>) {
  const { slug } = await params
  const name = decodeURIComponent(slug)
  const [posts, { language, postsPerPage }] = await Promise.all([getPublicPosts(), getSettings()])
  const filtered = posts.filter((p) => p.categories.includes(name))
  const { page } = await searchParams
  const { items, page: current, totalPages } = paginate(filtered, parsePage(page), postsPerPage)

  return (
    <section>
      <h1 className="mb-8 text-2xl font-bold tracking-tight">
        {t(language).categoryLabel}: {name}
      </h1>
      <PostList posts={items} lang={language} emptyText={t(language).emptyCategory} />
      <Pagination basePath={`/category/${slug}`} page={current} totalPages={totalPages} lang={language} />
    </section>
  )
}
