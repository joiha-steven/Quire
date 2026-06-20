// Root-level detail. A slug resolves to a post or a static page (shared URL
// namespace, so at most one matches). Drafts / future-dated posts are hidden.
// The featured image is used only for SEO/social meta, never rendered in-page.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost, getPublicPosts, getRelatedPosts } from '@/lib/posts'
import { getPage, getPublicPages } from '@/lib/pages'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { formatDate, t } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { JsonLd, articleSchema } from '@/components/blog/JsonLd'
import { Toc } from '@/components/blog/Toc'
import { ReadingProgress } from '@/components/blog/ReadingProgress'
import { RelatedPosts } from '@/components/blog/RelatedPosts'
import { ogImageUrl } from '@/lib/og'
import { isPublicallyVisible, readingMinutes, extractHeadings } from '@/lib/utils'

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
  const [post, page, settings] = await Promise.all([getPost(slug), getPage(slug), getSettings()])
  const base = resolveSiteUrl(settings)
  if (post && isPublicallyVisible(post.status, post.date)) {
    const og = ogImageUrl(settings, base, { title: post.title, featuredImage: post.featuredImage })
    const images = og ? [og] : undefined
    return {
      title: post.title,
      description: post.excerpt || undefined,
      openGraph: { title: post.title, description: post.excerpt || undefined, images, type: 'article' },
      twitter: { card: images ? 'summary_large_image' : 'summary', images },
    }
  }
  if (page && page.status === 'published') {
    const og = ogImageUrl(settings, base, { title: page.title, featuredImage: page.featuredImage })
    const images = og ? [og] : undefined
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
  const [post, page, settings] = await Promise.all([
    getPost(slug),
    getPage(slug),
    getSettings(),
  ])
  const { language } = settings

  // Post wins if visible; otherwise fall back to a published page.
  if (post && isPublicallyVisible(post.status, post.date)) {
    const base = resolveSiteUrl(settings)
    const { features } = settings
    const headings = features.toc ? extractHeadings(post.content) : []
    const minutes = readingMinutes(post.content)
    const related = features.related ? await getRelatedPosts(post.slug) : []
    const hasTaxo = post.tags.length > 0 || post.categories.length > 0
    return (
      <article>
        {features.progressBar && <ReadingProgress />}
        {settings.seo.autoSchema && (
          <JsonLd
            data={articleSchema({
              title: post.title,
              url: `${base}/${post.slug}`,
              datePublished: post.date,
              description: post.excerpt || undefined,
              image: post.featuredImage,
              authorName: settings.title,
            })}
          />
        )}
        <h1 className="text-3xl font-bold leading-tight tracking-tight">{post.title}</h1>
        <p className="mt-3 text-sm text-meta">
          {formatDate(post.date, language)}
          {features.readingTime && ` · ${minutes} ${t(language).readingSuffix}`}
        </p>

        {/* relative so the desktop ToC can anchor its top to the content body */}
        <div className="relative mt-8">
          {headings.length >= 3 && <Toc headings={headings} title={t(language).tocTitle} />}
          <PostContent markdown={post.content} />
        </div>

        {/* The global `hr` rule (unlayered) forces margin:0 and beats Tailwind
            margin utilities, so spacing goes on wrapper divs, not the <hr>. */}
        {hasTaxo && (
          <>
            <div className="mt-12">
              <hr />
            </div>
            <footer className="mt-6 space-y-1 text-sm text-meta">
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
          </>
        )}

        {related.length > 0 && (
          <>
            <div className="mt-12">
              <hr />
            </div>
            <div className="mt-6">
              <RelatedPosts posts={related} lang={language} />
            </div>
          </>
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
