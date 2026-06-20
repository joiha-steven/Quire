// Home: first page of published posts, newest first. Deeper pages: /page/[n].
import { getPublicPosts } from '@/lib/posts'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { JsonLd, websiteSchema } from '@/components/blog/JsonLd'

export default async function HomePage() {
  const [posts, settings] = await Promise.all([getPublicPosts(), getSettings()])

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
      <BlogListing posts={posts} page={1} basePath="/" emptyText={t(settings.language).emptyPosts} />
    </>
  )
}
