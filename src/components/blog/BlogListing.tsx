// Shared paginated post list (home / category / tag). Pagination is path-based
// (`/page/2`, `/category/x/page/2`) — no `?query`, which is friendlier for SEO.
// Page 1 always lives at the bare basePath; deeper pages live under /page/[n].
import { notFound } from 'next/navigation'
import type { Post } from '@/types'
import { getSettings } from '@/lib/settings'
import { paginate } from '@/lib/paginate'
import { PostList } from './PostList'
import { Pagination } from './Pagination'

export async function BlogListing({
  posts,
  page,
  basePath,
  emptyText,
  heading,
}: {
  posts: Post[]
  page: number
  basePath: string // '/', '/category/x', '/tag/x' (no trailing slash except home)
  emptyText: string
  heading?: React.ReactNode
}) {
  const { language, postsPerPage, features } = await getSettings()
  const { items, page: current, totalPages } = paginate(posts, page, postsPerPage)
  // A deep page number that doesn't exist is a 404 (don't silently clamp — that
  // would serve duplicate content under a bogus URL).
  if (page > 1 && page > totalPages) notFound()

  return (
    <>
      {heading}
      <PostList
        posts={items}
        lang={language}
        emptyText={emptyText}
        showReadingTime={features.readingTime}
      />
      <Pagination basePath={basePath} page={current} totalPages={totalPages} lang={language} />
    </>
  )
}
