// Home: paginated list of published posts, newest first.
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { paginate, parsePage } from '@/lib/paginate'
import { PostList } from '@/components/blog/PostList'
import { Pagination } from '@/components/blog/Pagination'


export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const [posts, { language, postsPerPage }] = await Promise.all([getPublicPosts(), getSettings()])
  const { page } = await searchParams
  const { items, page: current, totalPages } = paginate(posts, parsePage(page), postsPerPage)

  return (
    <>
      <PostList posts={items} lang={language} emptyText={t(language).emptyPosts} />
      <Pagination basePath="/" page={current} totalPages={totalPages} lang={language} />
    </>
  )
}
