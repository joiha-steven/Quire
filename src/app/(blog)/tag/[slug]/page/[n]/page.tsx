// Tag pagination: /tag/[slug]/page/2, … (page 1 lives at /tag/[slug]).
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicPosts } from '@/lib/posts'
import { resolveTerm } from '@/lib/taxonomy'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { parsePathPage } from '@/lib/paginate'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

export async function generateMetadata({ params }: PageProps<'/tag/[slug]/page/[n]'>): Promise<Metadata> {
  const { slug, n } = await params
  return { alternates: { canonical: `/tag/${slug}/page/${n}` } }
}

export default async function TagPaged({ params }: PageProps<'/tag/[slug]/page/[n]'>) {
  const { slug, n } = await params
  // /tag/<x>/page/1 is 308'd to the base in middleware; only junk/out-of-range reach here.
  const page = parsePathPage(n)
  if (page === null) notFound()
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  const { name, posts: filtered } = resolveTerm(posts, 'tags', slug)
  if (!name) notFound()

  return (
    <section>
      <BlogListing
        posts={filtered}
        page={page}
        basePath={`/tag/${slug}`}
        emptyText={t(language).emptyTag}
        heading={<h1 className="mb-8 fs-h1 font-bold">{t(language).tagLabel}: #{name}</h1>}
      />
    </section>
  )
}
