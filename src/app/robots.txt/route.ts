// Dynamic robots.txt (raw route so it can also carry Content-Signal directives,
// which the MetadataRoute robots helper can't emit). Gated by settings.seo.robots;
// /admin and /api are always disallowed. When the sitemap feature is on, the
// sitemap URL is advertised.
//
// Policy (when robots is on): welcome real search engines + reputable AI
// assistants (this blog ships /llms.txt for them), and turn away the aggressive
// SEO/data scrapers that crawl heavily for nobody's benefit. robots.txt is a
// politeness contract, not a security control — only well-behaved bots obey it,
// which is exactly the crawl-budget/bandwidth we want to shape here.
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
const BAD_BOTS = [
  'AhrefsBot', 'SemrushBot', 'MJ12bot', 'DotBot', 'DataForSeoBot',
  'BLEXBot', 'PetalBot', 'Barkrowler', 'serpstatbot', 'ZoominfoBot',
  'MauiBot', 'magpie-crawler', 'Bytespider', 'ImagesiftBot', 'SeekportBot',
]

// Content Signals (contentsignals.org / IETF draft): declare how this content may
// be used, in machine-readable form. This blog already welcomes AI (allows the AI
// bots above + ships /llms.txt), so the signal matches that stance — search,
// AI training, and AI input (RAG/answers) are all permitted. Attached to the
// catch-all group so it applies site-wide.
const CONTENT_SIGNAL = 'search=yes, ai-train=yes, ai-input=yes'

// One robots group: N user-agent lines followed by its directives.
function group(agents: string[], directives: string[]): string {
  return [...agents.map((a) => `User-agent: ${a}`), ...directives].join('\n')
}

export async function GET(): Promise<Response> {
  const s = await getSettings()
  const base = resolveSiteUrl(s)
  const disallow = OFF_LIMITS.map((p) => `Disallow: ${p}`)

  let body: string
  if (!s.seo.robots) {
    // Feature off -> minimal allow-all, no sitemap reference.
    body = group(['*'], ['Allow: /', ...disallow])
  } else {
    const blocks = [
      // Search + AI bots: full access except the admin/API surface.
      group([...SEARCH_BOTS, ...AI_BOTS], ['Allow: /', ...disallow]),
      // Scrapers: turned away entirely.
      group(BAD_BOTS, ['Disallow: /']),
      // Everyone else (new/unknown good bots included): same off-limits + the
      // content-usage signal.
      group(['*'], ['Allow: /', ...disallow, `Content-Signal: ${CONTENT_SIGNAL}`]),
    ]
    if (s.seo.sitemap) blocks.push(`Sitemap: ${base}/sitemap.xml`)
    blocks.push(`Host: ${base}`)
    body = blocks.join('\n\n')
  }

  return new Response(body + '\n', {
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
  })
}
