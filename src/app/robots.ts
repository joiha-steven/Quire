// Dynamic robots.txt. Gated by settings.seo.robots; /admin and /api are always
// disallowed. When the sitemap feature is on, the sitemap URL is advertised.
//
// Policy (when robots is on): welcome real search engines + reputable AI
// assistants (this blog ships /llms.txt for them), and turn away the aggressive
// SEO/data scrapers that crawl heavily for nobody's benefit. robots.txt is a
// politeness contract, not a security control — only well-behaved bots obey it,
// which is exactly the crawl-budget/bandwidth we want to shape here.
import type { MetadataRoute } from 'next'
import { getSettings, resolveSiteUrl } from '@/lib/settings'

export const revalidate = 3600 // ISR; admin save purges via revalidatePath('/','layout')

const OFF_LIMITS = ['/admin', '/api']

// Major search engines — explicit so the welcome is documented in the file.
const SEARCH_BOTS = ['Googlebot', 'Bingbot', 'DuckDuckBot', 'Applebot', 'YandexBot']

// AI assistants / answer engines we allow (paired with /llms.txt).
const AI_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot', // OpenAI
  'ClaudeBot', 'Claude-Web', 'anthropic-ai', // Anthropic
  'PerplexityBot', 'Perplexity-User', // Perplexity
  'Google-Extended', // Gemini / Vertex AI
  'Applebot-Extended', // Apple Intelligence
  'CCBot', // Common Crawl
  'cohere-ai', 'Meta-ExternalAgent', 'DuckAssistBot', // Cohere, Meta AI, DuckDuckGo AI
]

// Aggressive SEO/data scrapers + backlink miners: heavy crawl, no referral value.
// Blocked to protect crawl budget and bandwidth. (Truly malicious bots ignore
// robots.txt anyway — these are the polite-but-unwanted ones worth turning away.)
const BAD_BOTS = [
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot',
  'BLEXBot', 'PetalBot', 'Barkrowler', 'serpstatbot', 'ZoominfoBot',
  'MauiBot', 'magpie-crawler', 'Bytespider', 'ImagesiftBot', 'SeekportBot',
]

export default async function robots(): Promise<MetadataRoute.Robots> {
  const s = await getSettings()
  const base = resolveSiteUrl(s)

  // Feature off -> minimal allow-all, no sitemap reference.
  if (!s.seo.robots) {
    return { rules: { userAgent: '*', allow: '/', disallow: OFF_LIMITS } }
  }

  return {
    rules: [
      // Search + AI bots: full access except the admin/API surface.
      { userAgent: [...SEARCH_BOTS, ...AI_BOTS], allow: '/', disallow: OFF_LIMITS },
      // Scrapers: turned away entirely.
      { userAgent: BAD_BOTS, disallow: '/' },
      // Everyone else: welcome (new/unknown good bots included), same off-limits.
      { userAgent: '*', allow: '/', disallow: OFF_LIMITS },
    ],
    sitemap: s.seo.sitemap ? `${base}/sitemap.xml` : undefined,
    host: base,
  }
}
