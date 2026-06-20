// Dynamic sitemap.xml from published posts + pages (and their taxonomy).
// Returns an empty sitemap when the feature is toggled off.
import type { MetadataRoute } from 'next'
import { getPublicPosts, getCategories, getTags } from '@/lib/posts'
import { getPublicPages } from '@/lib/pages'
import { getSettings, resolveSiteUrl } from '@/lib/settings'

export const dynamic = 'force-dynamic' // reflect new posts + SEO toggles immediately

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

  const enc = (v: string) => encodeURIComponent(v)
  const newest = posts[0]?.date ?? new Date().toISOString()

  return [
    { url: base, lastModified: newest, changeFrequency: 'daily', priority: 1 },
    ...posts.map((p) => ({
      url: `${base}/${p.slug}`,
      lastModified: p.date,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...pages.map((p) => ({ url: `${base}/${p.slug}`, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...categories.map((c) => ({ url: `${base}/category/${enc(c)}`, changeFrequency: 'weekly' as const, priority: 0.4 })),
    ...tags.map((t) => ({ url: `${base}/tag/${enc(t)}`, changeFrequency: 'weekly' as const, priority: 0.3 })),
  ]
}
