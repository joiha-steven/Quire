// Root-level detail. A slug resolves to a post or a static page (shared URL
// namespace, so at most one matches). Drafts / future-dated posts are hidden.
// The featured image is used only for SEO/social meta, never rendered in-page.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost, getPublicPosts, getRelatedPosts } from '@/lib/posts'
import { termSlug } from '@/lib/taxonomy'
import { getPage, getPublicPages } from '@/lib/pages'
import { getMedia } from '@/lib/media'
import { collapseBlob } from '@/lib/blob'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { formatDate, t } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { JsonLd, articleSchema } from '@/components/blog/JsonLd'
import { Toc, TOC_ANCHORS } from '@/components/blog/Toc'
import { ReadingProgress } from '@/components/blog/ReadingProgress'
import { BackToTop } from '@/components/blog/BackToTop'
import { ScrollDepth } from '@/components/blog/ScrollDepth'
import { RelatedPosts } from '@/components/blog/RelatedPosts'
import { Comments } from '@/components/blog/Comments'
import { getCommentEnv } from '@/lib/comment-env'
import { ogImageUrl } from '@/lib/og'
import { isPublicallyVisible, readingMinutes, extractHeadings, extractImageUrls } from '@/lib/utils'

// ISR-cached for fast reads. An edit to this post/page purges it immediately via
// revalidatePath('/', 'layout') in the save route; the 1h window is a safety net.
export const revalidate = 3600
export const dynamicParams = true // slugs not prebuilt below render on first visit

// Prerender all known post/page slugs at build, then keep them fresh via ISR.
export async function generateStaticParams() {
  const [posts, pages] = await Promise.all([getPublicPosts(), getPublicPages()])
  const slugs = new Set([...posts.map((p) => p.slug), ...pages.map((p) => p.slug)])
  return [...slugs].map((slug) => ({ slug }))
}

// Render a taxonomy list as comma-separated links: "a, b, c".
function taxoLinks(items: string[], make: (s: string) => string) {
  return items.map((it, i) => (
    <span key={it}>
      {i > 0 && ', '}
      <Link href={make(it)} className="hover:text-heading">
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
  const [post, page, settings, media] = await Promise.all([
    getPost(slug),
    getPage(slug),
    getSettings(),
    getMedia(),
  ])
  const { language } = settings
  // Originals whose AVIF/WebP variants exist — only these get a <picture>; the
  // rest render as a plain <img> so a missing variant never blanks the image.
  const readyOriginals = new Set(media.filter((m) => m.variants).map((m) => collapseBlob(m.url)))
  // Intrinsic dimensions per original (collapsed pathname) so body images render
  // with a reserved box — no layout shift (CLS) as they load.
  const imageDims = new Map(
    media
      .filter((m) => m.width && m.height)
      .map((m) => [collapseBlob(m.url), { width: m.width!, height: m.height! }] as const),
  )

  // Post wins if visible; otherwise fall back to a published page.
  if (post && isPublicallyVisible(post.status, post.date)) {
    const base = resolveSiteUrl(settings)
    const { features } = settings
    const headings = features.toc ? extractHeadings(post.content) : []
    const minutes = readingMinutes(post.content)
    const related = features.related ? await getRelatedPosts(post.slug, settings.relatedCount) : []
    const commentEnv = settings.comments.enabled ? await getCommentEnv() : null
    const hasTaxo = post.tags.length > 0 || post.categories.length > 0
    const showComments = Boolean(settings.comments.enabled && commentEnv)
    // ONE in-page jump under the ToC headings: the present section labels joined
    // (Thẻ / Danh mục / Bình luận), scrolling to the first section that exists.
    const tx = t(language)
    const metaParts = [
      post.tags.length > 0 ? tx.tagLabel : null,
      post.categories.length > 0 ? tx.categoryLabel : null,
      showComments ? tx.commentsHeading : null,
    ].filter((p): p is string => p !== null)
    const metaAnchor = post.tags.length > 0
      ? TOC_ANCHORS.tags
      : post.categories.length > 0
        ? TOC_ANCHORS.categories
        : TOC_ANCHORS.comments
    const tocMeta = metaParts.length ? { label: metaParts.join(' / '), anchor: metaAnchor } : undefined
    return (
      <article>
        {features.progressBar && <ReadingProgress />}
        <BackToTop label={t(language).backToTop} />
        <ScrollDepth />
        {settings.seo.autoSchema && (
          <JsonLd
            data={articleSchema({
              title: post.title,
              url: `${base}/${post.slug}`,
              datePublished: post.date,
              description: post.excerpt || undefined,
              // Featured image if set, else the first image in the body — so the
              // article's structured data always points at an image on this page.
              image: post.featuredImage || extractImageUrls(post.content)[0],
              authorName: settings.title,
            })}
          />
        )}
        {/* Single post/page title = H1 scale (--fs-h1); list cards use H2 a step down. */}
        <h1 className="fs-h1 font-semibold tracking-tight">{post.title}</h1>
        <p className="mt-3 t-small text-meta">
          {formatDate(post.date, language)}
          {features.readingTime && ` · ${minutes} ${t(language).readingSuffix}`}
        </p>

        {/* The ToC is fixed to the viewport (see Toc.tsx) — left-pinned on desktop,
            a left-edge tab + slide-out on mobile — not anchored here. */}
        <div className="mt-8">
          {headings.length >= 3 && <Toc headings={headings} title={tx.tocTitle} meta={tocMeta} />}
          <PostContent markdown={post.content} readyOriginals={readyOriginals} imageDims={imageDims} />
        </div>

        {/* The global `hr` rule (unlayered) forces margin:0 and beats Tailwind
            margin utilities, so spacing goes on wrapper divs, not the <hr>. */}
        {hasTaxo && (
          <>
            <div className="mt-12">
              <hr />
            </div>
            <footer className="mt-6 space-y-1 t-small text-meta">
              {post.tags.length > 0 && (
                <p id={TOC_ANCHORS.tags} className="scroll-mt-24">
                  {tx.tagLabel}: {taxoLinks(post.tags, (s) => `/tag/${termSlug(s)}`)}
                </p>
              )}
              {post.categories.length > 0 && (
                <p id={TOC_ANCHORS.categories} className="scroll-mt-24">
                  {tx.categoryLabel}: {taxoLinks(post.categories, (s) => `/category/${termSlug(s)}`)}
                </p>
              )}
            </footer>
          </>
        )}

        {related.length > 0 && (
          <>
            {/* After tags: mt-6 so they sit evenly between both rules (1.5rem each
                side). Without tags: mt-12 to separate from the body. */}
            <div className={hasTaxo ? 'mt-6' : 'mt-12'}>
              <hr />
            </div>
            <div className="mt-6">
              <RelatedPosts posts={related} lang={language} />
            </div>
          </>
        )}

        {showComments && commentEnv && (
          <>
            <div id={TOC_ANCHORS.comments} className="mt-12 scroll-mt-24">
              <hr />
            </div>
            <Comments
              postSlug={post.slug}
              lang={language}
              turnstile={settings.comments.turnstile && commentEnv.turnstileConfigured}
              turnstileSiteKey={commentEnv.turnstileSiteKey}
              googleAuth={settings.comments.googleAuth && commentEnv.googleConfigured}
              facebookAuth={settings.comments.facebookAuth && commentEnv.facebookConfigured}
            />
          </>
        )}
      </article>
    )
  }

  if (page && page.status === 'published') {
    return (
      <article>
        <h1 className="fs-h1 font-semibold tracking-tight">{page.title}</h1>
        <div className="mt-8">
          <PostContent markdown={page.content} readyOriginals={readyOriginals} imageDims={imageDims} />
        </div>
      </article>
    )
  }

  notFound()
}
