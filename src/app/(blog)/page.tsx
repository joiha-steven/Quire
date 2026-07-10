// Home: first page of published posts, newest first. Deeper pages: /page/[n].
import type { Metadata } from 'next'
import { getPublicPosts } from '@/lib/posts'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { ogCardUrl, siteDomain } from '@/lib/og'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { HomeRail } from '@/components/blog/HomeRail'
import { JsonLd, websiteSchema } from '@/components/blog/JsonLd'

// ISR-cached for fast reads; admin saves purge it instantly via
// revalidatePath('/', 'layout'). The 1h window is just a safety net.
export const revalidate = 3600

// OG card: top line = domain, bottom line = site description.
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSettings()
  const base = resolveSiteUrl(settings)
  const og = ogCardUrl(settings, base, { title: siteDomain(base), site: settings.description })
  const images = og ? [og] : undefined
  return {
    openGraph: { title: settings.title, description: settings.description || undefined, images, type: 'website' },
    twitter: { card: images ? 'summary_large_image' : 'summary', images },
  }
}

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
      <BlogListing posts={posts} page={1} basePath="/" emptyText={t(settings.language).emptyPosts} lead />
      {/* After the listing: the rail is absolutely placed, so DOM order is free —
          and this keeps the page's h1 ahead of the sidebar's h2 headings. */}
      {settings.features.sidebar && <HomeRail lang={settings.language} />}
    </>
  )
}
