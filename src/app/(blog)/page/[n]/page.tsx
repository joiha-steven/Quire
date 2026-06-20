// Home pagination: /page/2, /page/3, … (page 1 lives at /).
import { notFound } from 'next/navigation'
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { parsePathPage } from '@/lib/paginate'

export default async function HomePaged({ params }: PageProps<'/page/[n]'>) {
  const { n } = await params
  const page = parsePathPage(n)
  if (page === null) notFound() // page 1 (and junk) only live at '/'
  const [posts, settings] = await Promise.all([getPublicPosts(), getSettings()])
  return <BlogListing posts={posts} page={page} basePath="/" emptyText={t(settings.language).emptyPosts} />
}
