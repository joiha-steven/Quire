// Dynamic robots.txt. Gated by settings.seo.robots; /admin and /api are always
// disallowed. When the sitemap feature is on, the sitemap URL is advertised.
import type { MetadataRoute } from 'next'
import { getSettings, resolveSiteUrl } from '@/lib/settings'

export const dynamic = 'force-dynamic' // reflect SEO toggles immediately

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings()
  const base = resolveSiteUrl(s)

  // Feature off -> minimal allow-all, no sitemap reference.
  if (!s.seo.robots) {
    return { rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] } }
  }

  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api'] },
    sitemap: s.seo.sitemap ? `${base}/sitemap.xml` : undefined,
    host: base,
  }
}
