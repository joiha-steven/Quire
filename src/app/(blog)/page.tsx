// Home: paginated list of published posts, newest first.
import { getPublicPosts } from '@/lib/posts'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { paginate, parsePage } from '@/lib/paginate'
import { PostList } from '@/components/blog/PostList'
import { Pagination } from '@/components/blog/Pagination'
import { JsonLd, websiteSchema } from '@/components/blog/JsonLd'


export default async function HomePage({ searchParams }: PageProps<'/'>) {
  const [posts, settings] = await Promise.all([getPublicPosts(), getSettings()])
  const { language, postsPerPage } = settings
  const { page } = await searchParams
  const { items, page: current, totalPages } = paginate(posts, parsePage(page), postsPerPage)

  return (
    <>
      {settings.seo.autoSchema && (
        <JsonLd
          data={websiteSchema({
            name: settings.title,
            url: resolveSiteUrl(settings),
            description: settings.description || undefined,
          })}
        />
      )}
      <PostList posts={items} lang={language} emptyText={t(language).emptyPosts} />
      <Pagination basePath="/" page={current} totalPages={totalPages} lang={language} />
    </>
  )
}
