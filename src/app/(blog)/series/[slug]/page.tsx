// Posts in one series, in series order (not by date). No pagination — a series is a
// finite, hand-ordered set.
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveSeries } from '@/lib/series'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { ogCardUrl, siteDomain } from '@/lib/og'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

export async function generateMetadata({ params }: PageProps<'/series/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const { name } = await resolveSeries(slug)
  if (!name) return {}
  const settings = await getSettings()
  const base = resolveSiteUrl(settings)
  const og = ogCardUrl(settings, base, { title: name, site: siteDomain(base) })
  const images = og ? [og] : undefined
  return {
    title: name,
    alternates: { canonical: `/series/${slug}` },
    openGraph: { title: name, images, type: 'website' },
    twitter: { card: images ? 'summary_large_image' : 'summary', images },
  }
}

export default async function SeriesPage({ params }: PageProps<'/series/[slug]'>) {
  const { slug } = await params
  const [{ language }, { name, posts }] = await Promise.all([getSettings(), resolveSeries(slug)])
  if (!name) notFound()

  return (
    <section>
      <BlogListing
        posts={posts}
        page={1}
        basePath={`/series/${slug}`}
        emptyText={t(language).emptySeries}
        heading={<h1 className="mb-8 fs-h1 font-bold">{t(language).seriesLabel}: {name}</h1>}
      />
    </section>
  )
}
