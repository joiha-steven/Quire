// Resolve the OG/Twitter image URL for a post or page, honoring the SEO toggles.
// - Dynamic OG on  -> a generated /og card (title over featuredImage | fallback | gradient).
// - Dynamic OG off -> the featured image, else the owner's fallback image, else none.
import type { SiteSettings } from '@/types'

export function ogImageUrl(
  settings: SiteSettings,
  base: string,
  opts: { title: string; featuredImage?: string },
): string | undefined {
  const { ogImage, ogFallbackImage } = settings.seo
  const bg = opts.featuredImage || ogFallbackImage || ''
  if (ogImage) {
    const p = new URLSearchParams({ title: opts.title, site: settings.title })
    if (bg) p.set('bg', bg)
    return `${base}/og?${p.toString()}`
  }
  return bg || undefined
}
