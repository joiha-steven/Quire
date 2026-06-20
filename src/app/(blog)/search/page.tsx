// Search page: the server loads the published-post index once and a client
// component filters it in memory. No API/DB needed.
import type { Metadata } from 'next'
import { getPublicPosts } from '@/lib/posts'
import { getSettings } from '@/lib/settings'
import { t } from '@/lib/i18n'
import { foldAccents } from '@/lib/utils'
import { SearchClient, type SearchDoc } from '@/components/blog/SearchClient'

export async function generateMetadata(): Promise<Metadata> {
  const { language } = await getSettings()
  return { title: t(language).search }
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const [posts, { language }] = await Promise.all([getPublicPosts(), getSettings()])
  const { q } = await searchParams
  const initial = typeof q === 'string' ? q : ''
  // Lean, pre-folded index: title + tags + categories only (no excerpt/image).
  const docs: SearchDoc[] = posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    date: p.date,
    terms: foldAccents([p.title, p.tags.join(' '), p.categories.join(' ')].join(' ')),
  }))
  return <SearchClient docs={docs} lang={language} initialQuery={initial} />
}
