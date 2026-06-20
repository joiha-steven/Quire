// Posts filtered by category, first page. Deeper pages: /category/[slug]/page/[n].
import type { Metadata } from 'next'
import { getPublicPosts } from '@/lib/posts'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { ogCardUrl, siteDomain } from '@/lib/og'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

// OG card: top line = category name, bottom line = domain.
export async function generateMetadata({ params }: PageProps<'/category/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const name = decodeURIComponent(slug)
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
