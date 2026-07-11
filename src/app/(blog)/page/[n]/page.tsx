// Home pagination: /page/2, /page/3, … (page 1 lives at /).
import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { BlogListing } from '@/components/blog/BlogListing'
import { parsePathPage } from '@/lib/paginate'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

// Self-canonical so paginated pages don't dedupe against page 1 / each other.
export async function generateMetadata({ params }: PageProps<'/page/[n]'>): Promise<Metadata> {
  const { n } = await params
  return { alternates: { canonical: `/page/${n}` } }
}

export default async function HomePaged({ params }: PageProps<'/page/[n]'>) {
  const { n } = await params
  if (n === '1') permanentRedirect('/') // page 1 IS the home — 308, not a duplicate
  const page = parsePathPage(n)
  if (page === null) notFound() // junk (non-numeric, <1) only live at '/'
  const [posts, settings] = await Promise.all([getPublicPosts(), getSettings()])
  return <BlogListing posts={posts} page={page} basePath="/" emptyText={t(settings.language).emptyPosts} />
}
