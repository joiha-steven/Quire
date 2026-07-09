// Tag pagination: /tag/[slug]/page/2, … (page 1 lives at /tag/[slug]).
import { notFound } from 'next/navigation'
import { getPublicPosts } from '@/lib/posts'
import { resolveTerm } from '@/lib/taxonomy'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { parsePathPage } from '@/lib/paginate'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

export default async function TagPaged({ params }: PageProps<'/tag/[slug]/page/[n]'>) {
  const { slug, n } = await params
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
