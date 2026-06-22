// Dynamic sitemap.xml from published posts + pages (and their taxonomy).
// Returns an empty sitemap when the feature is toggled off.
import type { MetadataRoute } from 'next'
import { getPublicPosts, getPost, getCategories, getTags } from '@/lib/posts'
import { termSlug } from '@/lib/taxonomy'
import { getPublicPages } from '@/lib/pages'
import { getSettings, resolveSiteUrl } from '@/lib/settings'
import { extractImageUrls } from '@/lib/utils'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const s = await getSettings()
  if (!s.seo.sitemap) return []

  const base = resolveSiteUrl(s)
  const [posts, pages, categories, tags] = await Promise.all([
    getPublicPosts(),
    getPublicPages(),
    getCategories(),
    getTags(),
  ])

  const newest = posts[0]?.date ?? new Date().toISOString()

  // Per-post images for an image sitemap (`<image:image>`), so search engines
  // associate every image with the manhhung.me page that embeds it — even though
  // the files are served from the Blob host. Read each body once (ISR-cached).
  const postImages = await Promise.all(
    posts.map(async (p) => {
      const full = await getPost(p.slug)
      const imgs = [
        ...(p.featuredImage ? [p.featuredImage] : []),
        ...(full ? extractImageUrls(full.content) : []),
      ]
      return [...new Set(imgs)]
    }),
  )

  return [
    { url: base, lastModified: newest, changeFrequency: 'daily', priority: 1 },
    ...posts.map((p, i) => ({
      url: `${base}/${p.slug}`,
      lastModified: p.date,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      ...(postImages[i].length ? { images: postImages[i] } : {}),
    })),
    ...pages.map((p) => ({ url: `${base}/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...categories.map((c) => ({ url: `${base}/category/${termSlug(c)}`, changeFrequency: 'weekly' as const, priority: 0.4 })),
    ...tags.map((t) => ({ url: `${base}/tag/${termSlug(t)}`, changeFrequency: 'weekly' as const, priority: 0.3 })),
  ]
}
