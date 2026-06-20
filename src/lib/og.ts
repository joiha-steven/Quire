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

// Hostname only (no protocol/path) for the OG card's domain line, e.g.
// "blog.example.com".
export function siteDomain(base: string): string {
  try {
    return new URL(base).host
  } catch {
    return base.replace(/^https?:\/\//, '').replace(/\/+$/, '')
  }
}

// Dynamic OG card for the LIST surfaces (home, category, tag) where the two text
// lines are supplied explicitly: `title` = big top line, `site` = small bottom
// line. Same card as posts/pages — honors the dynamic-OG toggle and uses the
// owner's fallback image as the background when set (else the gradient). When
// dynamic OG is off, returns the fallback image itself, or undefined if none.
//   home:        { title: domain,    site: description }
//   category/tag:{ title: name,      site: domain }
export function ogCardUrl(
  settings: SiteSettings,
  base: string,
  opts: { title: string; site: string },
): string | undefined {
  const { ogImage, ogFallbackImage } = settings.seo
  if (ogImage) {
    const p = new URLSearchParams({ title: opts.title, site: opts.site })
    if (ogFallbackImage) p.set('bg', ogFallbackImage)
    return `${base}/og?${p.toString()}`
  }
  return ogFallbackImage || undefined
}
