// Root-level detail. A slug resolves to a post or a static page (shared URL
// namespace, so at most one matches). Drafts / future-dated posts are hidden.
// The featured image is used only for SEO/social meta, never rendered in-page.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost, getPublicPosts } from '@/lib/posts'
import { getPage, getPublicPages } from '@/lib/pages'
import { getSettings } from '@/lib/settings'
import { formatDate, t } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { isPublicallyVisible } from '@/lib/utils'

// Pre-build all public slugs at deploy time; new slugs render on first visit (ISR).
export async function generateStaticParams() {
  const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
  const slugs = new Set([...posts.map((p) => p.slug), ...pages.map((p) => p.slug)])
  return [...slugs].map((slug) => ({ slug }))
}

export const dynamicParams = true

// Render a taxonomy list as comma-separated links: "a, b, c".
function taxoLinks(items: string[], make: (s: string) => string) {
  return items.map((it, i) => (
    <span key={it}>
      {i > 0 && ', '}
      <Link href={make(it)} className="hover:text-[var(--c-heading)]">
        {it}
      </Link>
    </span>
  ))
}

export async function generateMetadata({ params }: PageProps<'/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const [post, page] = await Promise.all([getPost(slug), getPage(slug)])
  if (post && isPublicallyVisible(post.status, post.date)) {
    const images = post.featuredImage ? [post.featuredImage] : undefined
    return {
      title: post.title,
      description: post.excerpt || undefined,
      openGraph: { title: post.title, description: post.excerpt || undefined, images, type: 'article' },
      twitter: { card: images ? 'summary_large_image' : 'summary', images },
    }
  }
  if (page && page.status === 'published') {
    const images = page.featuredImage ? [page.featuredImage] : undefined
    return {
      title: page.title,
      openGraph: { title: page.title, images, type: 'website' },
      twitter: { card: images ? 'summary_large_image' : 'summary', images },
    }
  }
  return {}
}

export default async function EntryPage({ params }: PageProps<'/[slug]'>) {
  const { slug } = await params
  const [post, page, { language }] = await Promise.all([
    getPost(slug),
    getPage(slug),
    getSettings(),
  ])

  // Post wins if visible; otherwise fall back to a published page.
  if (post && isPublicallyVisible(post.status, post.date)) {
    return (
      <article>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">{post.title}</h1>
        <p className="mt-3 text-sm text-meta">{formatDate(post.date, language)}</p>

        <div className="mt-8">
          <PostContent markdown={post.content} />
        </div>

        {(post.tags.length > 0 || post.categories.length > 0) && (
          <footer className="mt-12 space-y-1 border-t border-[var(--c-rule)] pt-6 text-sm text-meta">
            {post.tags.length > 0 && (
              <p>
                {t(language).tagLabel}: {taxoLinks(post.tags, (s) => `/tag/${encodeURIComponent(s)}`)}
              </p>
            )}
            {post.categories.length > 0 && (
              <p>
                {t(language).categoryLabel}: {taxoLinks(post.categories, (s) => `/category/${encodeURIComponent(s)}`)}
              </p>
            )}
          </footer>
        )}
      </article>
    )
  }

  if (page && page.status === 'published') {
    return (
      <article>
        <h1 className="text-3xl font-bold leading-tight tracking-tight">{page.title}</h1>
        <div className="mt-8">
          <PostContent markdown={page.content} />
        </div>
      </article>
    )
  }

  notFound()
}
