// Category pagination: /category/[slug]/page/2, … (page 1 lives at /category/[slug]).
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicPosts } from '@/lib/posts'
import { resolveTerm } from '@/lib/taxonomy'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { parsePathPage } from '@/lib/paginate'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

export async function generateMetadata({ params }: PageProps<'/category/[slug]/page/[n]'>): Promise<Metadata> {
  const { slug, n } = await params
  return { alternates: { canonical: `/category/${slug}/page/${n}` } }
}

export default async function CategoryPaged({ params }: PageProps<'/category/[slug]/page/[n]'>) {
  const { slug, n } = await params
  if (n === '1') permanentRedirect(`/category/${slug}`) // page 1 lives at the base
  const page = parsePathPage(n)
  if (page === null) notFound()
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  const { name, posts: filtered } = resolveTerm(posts, 'categories', slug)
  if (!name) notFound()

  return (
    <section>
      <BlogListing
        posts={filtered}
        page={page}
        basePath={`/category/${slug}`}
        emptyText={t(language).emptyCategory}
        heading={<h1 className="mb-8 fs-h1 font-bold">{t(language).categoryLabel}: {name}</h1>}
      />
    </section>
  )
}
