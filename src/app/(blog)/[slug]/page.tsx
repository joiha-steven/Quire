// Root-level detail. A slug resolves to a post or a static page (shared URL
// namespace, so at most one matches). Drafts / future-dated posts are hidden.
// The featured image is used only for SEO/social meta, never rendered in-page.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPost, getPublicPosts, getRelatedPosts } from '@/lib/posts'
import { getSeriesForPost } from '@/lib/series'
import { termSlug } from '@/lib/taxonomy'
import { getPage, getPublicPages } from '@/lib/pages'
import { getMedia } from '@/lib/media'
import { collapseBlob } from '@/lib/blob'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { formatDate, formatCount, t } from '@/lib/i18n'
import { PostContent } from '@/components/blog/PostContent'
import { JsonLd, articleSchema, breadcrumbSchema } from '@/components/blog/JsonLd'
import { Toc } from '@/components/blog/Toc'
import { Rail } from '@/components/blog/Rail'
import { TOC_ANCHORS } from '@/lib/toc'
import { ReadingProgress } from '@/components/blog/ReadingProgress'
import { BackToTop } from '@/components/blog/BackToTop'
import { ScrollDepth } from '@/components/blog/ScrollDepth'
import { Lightbox } from '@/components/blog/Lightbox'
import { CodeCopy } from '@/components/blog/CodeCopy'
import { RelatedPosts } from '@/components/blog/RelatedPosts'
import { SeriesBox } from '@/components/blog/SeriesBox'
import { SubscribeForm } from '@/components/blog/SubscribeForm'
import { getMailStatus } from '@/lib/mail'
import { CommentsLazy } from '@/components/blog/CommentsLazy'
import { getCommentEnv } from '@/lib/comment-env'
import { ogImageUrl } from '@/lib/og'
import { isPublicallyVisible, readingMinutes, wordCount, extractHeadings, extractImageUrls, toPlainText, clampExcerpt } from '@/lib/utils'

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
function taxoLinks(items: string[], make: (s: string) => string, lower = false) {
  return items.map((it, i) => (
    <span key={it}>
      {i > 0 && ', '}
      <Link href={make(it)} className={lower ? 'lowercase hover:text-heading' : 'hover:text-heading'}>
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
    // Per-post SEO overrides win; else the post title + excerpt.
    const seoTitle = post.metaTitle?.trim() || post.title
    const seoDesc = post.metaDescription?.trim() || post.excerpt || undefined
    const og = ogImageUrl(settings, base, {
      title: seoTitle,
      // A cover/featured image is the social card; cover wins as the visible hero.
      featuredImage: post.coverImage || post.featuredImage,
      // A fuller preview than the ~200-char list excerpt: up to 320 chars from the body.
      desc: post.metaDescription?.trim() || clampExcerpt(toPlainText(post.content), 320) || post.excerpt || undefined,
      date: formatDate(post.date, settings.language),
    })
    const images = og ? [og] : undefined
    return {
      title: seoTitle,
      description: seoDesc,
      alternates: { canonical: `/${slug}` },
      openGraph: { title: seoTitle, description: seoDesc, images, type: 'article' },
      twitter: { card: images ? 'summary_large_image' : 'summary', images },
    }
  }
  if (page && page.status === 'published') {
    const og = ogImageUrl(settings, base, { title: page.title, featuredImage: page.featuredImage })
    const images = og ? [og] : undefined
    return {
      title: page.title,
      alternates: { canonical: `/${slug}` },
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
    const words = wordCount(post.content)
    const related = features.related ? await getRelatedPosts(post.slug, settings.relatedCount) : []
    const series = post.series ? await getSeriesForPost(post.slug) : null
    const mail = await getMailStatus() // show the subscribe form only when SMTP is set up
    const commentEnv = settings.comments.enabled ? await getCommentEnv() : null
    const hasTaxo = post.tags.length > 0 || post.categories.length > 0
    const showComments = Boolean(settings.comments.enabled && commentEnv)
    const tx = t(language)
    // ONE jump at the foot of the index: the end-of-article sections that exist
    // (Tags / Categories / Comments), scrolling to the first of them.
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
    // Every post gets an index: the title row alone is already useful.
    const showToc = features.toc && (headings.length > 0 || Boolean(tocMeta))
    const category = features.categoryLabel ? post.categories[0] : undefined
    // "Updated" only when a real edit happened well after publishing (>24h), so a
    // save right after publishing doesn't add noise.
    const updated =
      post.updatedAt && new Date(post.updatedAt).getTime() - new Date(post.date).getTime() > 86_400_000
        ? post.updatedAt
        : null
    // Body images: reused for the article schema AND to gate the Lightbox island — a
    // text-only post shouldn't load/hydrate the lightbox JS.
    const imageUrls = extractImageUrls(post.content)
    return (
      <article>
        {features.progressBar && <ReadingProgress />}
        <BackToTop label={t(language).backToTop} />
        <ScrollDepth />
        {imageUrls.length > 0 && <Lightbox lang={language} />}
        {post.content.includes('```') && <CodeCopy label={tx.copyCode} copiedLabel={tx.copiedCode} />}
        {settings.seo.autoSchema && (
          <JsonLd
            data={articleSchema({
              title: post.title,
              url: `${base}/${post.slug}`,
              datePublished: post.date,
              // Real last-modified time (falls back to datePublished inside articleSchema).
              dateModified: post.updatedAt,
              description: post.excerpt || undefined,
              // Cover/featured image if set, else the first image in the body — so the
              // article's structured data always points at an image on this page.
              image: post.coverImage || post.featuredImage || imageUrls[0],
              authorName: settings.title,
            })}
          />
        )}
        {settings.seo.autoSchema && (
          <JsonLd
            data={breadcrumbSchema([
              { name: settings.title, url: base },
              ...(category ? [{ name: category, url: `${base}/category/${termSlug(category)}` }] : []),
              { name: post.title, url: `${base}/${post.slug}` },
            ])}
          />
        )}
        {/* Meta line above the title, matching the list cards. */}
        <header>
          <p className="t-small text-meta">
            {category && (
              <>
                <Link href={`/category/${termSlug(category)}`} className="text-heading hover:text-meta">
                  {category}
                </Link>
                {' · '}
              </>
            )}
            {formatDate(post.date, language)}
            {updated && ` · ${tx.updatedPrefix} ${formatDate(updated, language)}`}
            {features.readingTime &&
              ` · ${formatCount(words, language)} ${t(language).wordsSuffix} · ${minutes} ${t(language).readingSuffix}`}
          </p>
          {/* Single post/page title = H1 scale (--fs-h1); list cards use H2 a step down. */}
          <h1 className="reading-font mt-2 fs-h1 font-semibold">{post.title}</h1>
          {/* Standfirst: the excerpt, so a long read opens on a sentence, not a wall. */}
          {features.deck && post.excerpt && <p className="mt-4 fs-h4 text-meta">{post.excerpt}</p>}
        </header>

        {/* The ToC lives in the left-gutter rail on wide screens; below the rail breakpoint
            the same markup is a slide-out drawer opened from the header. Placed after the
            title (absolutely positioned) so the h1 opens the outline. The reading view shows
            ONLY the ToC here — the site menu lives on the main (listing) sidebar. */}
        {showToc && (
          <Rail>
            <Toc headings={headings} title={tx.tocIndex} postTitle={post.title} meta={tocMeta} />
          </Rail>
        )}

        {post.coverImage && (
          // Visible hero. eslint-disable: intrinsic dims are unknown here; the CSS box
          // (aspect-video) reserves space, so there is no layout shift.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={post.coverImage}
            alt=""
            className="mt-8 aspect-video w-full rounded-lg object-cover"
            fetchPriority="high"
          />
        )}

        {series && series.posts.length > 1 && (
          <div className="mt-8">
            <SeriesBox info={series} lang={language} />
          </div>
        )}

        <div className="mt-10">
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
                  {tx.tagLabel}: {taxoLinks(post.tags, (s) => `/tag/${termSlug(s)}`, true)}
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

        {mail.configured && (
          <div className="mt-10">
            <SubscribeForm lang={language} />
          </div>
        )}

        {showComments && commentEnv && (
          <>
            <div id={TOC_ANCHORS.comments} className="mt-12 scroll-mt-24">
              <hr />
            </div>
            <CommentsLazy
              postSlug={post.slug}
              lang={language}
              turnstile={settings.comments.turnstile && commentEnv.turnstileConfigured}
              turnstileSiteKey={commentEnv.turnstileSiteKey}
              googleAuth={settings.comments.googleAuth && commentEnv.googleConfigured}
            />
          </>
        )}
      </article>
    )
  }

  if (page && page.status === 'published') {
    return (
      <article>
        <h1 className="reading-font fs-h1 font-semibold">{page.title}</h1>
        {extractImageUrls(page.content).length > 0 && <Lightbox lang={language} />}
        {page.content.includes('```') && <CodeCopy label={t(language).copyCode} copiedLabel={t(language).copiedCode} />}
        <div className="mt-8">
          <PostContent markdown={page.content} readyOriginals={readyOriginals} imageDims={imageDims} />
        </div>
      </article>
    )
  }

  notFound()
}
