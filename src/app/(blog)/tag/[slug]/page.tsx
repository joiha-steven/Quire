// Posts filtered by tag, first page. Deeper pages: /tag/[slug]/page/[n].
import type { Metadata } from 'next'
import { getPublicPosts } from '@/lib/posts'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { ogCardUrl, siteDomain } from '@/lib/og'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

// OG card: top line = #tag (the # marks it as a tag), bottom line = domain.
export async function generateMetadata({ params }: PageProps<'/tag/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const name = `#${decodeURIComponent(slug)}`
  const settings = await getSettings()
  const base = resolveSiteUrl(settings)
  const og = ogCardUrl(settings, base, { title: name, site: siteDomain(base) })
  const images = og ? [og] : undefined
  return {
    title: name,
    openGraph: { title: name, images, type: 'website' },
    twitter: { card: images ? 'summary_large_image' : 'summary', images },
  }
}

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
        heading={<h1 className="mb-8 fs-h1 font-bold tracking-tight">{t(language).tagLabel}: #{name}</h1>}
      />
    </section>
  )
}
