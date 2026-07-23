import type { NextConfig } from 'next'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Version-skew protection. A frequent deploy leaves already-open tabs on the OLD
// build; a soft navigation then mixes an old client runtime with new-build RSC/chunks
// and the router hangs on the loading skeleton (reload fixes it). With a deploymentId,
// every asset/RSC request carries `?dpl=<id>` and the client hard-navigates the moment
// it sees a different id from the server — so it self-heals instead of getting stuck.
// The SAME id must resolve at build AND at `next start`, so the deploy writes it to a
// `.deployment-id` file (the server has no .git); env wins if set.
function deploymentId(): string | undefined {
  if (process.env.NEXT_DEPLOYMENT_ID) return process.env.NEXT_DEPLOYMENT_ID
  try {
    return readFileSync(join(process.cwd(), '.deployment-id'), 'utf8').trim() || undefined
  } catch {
    return undefined
  }
}

const nextConfig: NextConfig = {
  deploymentId: deploymentId(),
  // Self-contained server bundle for the self-host image (`.next/standalone`), run as a
  // plain Node process. The build needs no backend: the data layer degrades to empty on
  // a missing DB (posts/pages readIndex catch), so `generateStaticParams` returns [] and
  // pages render on-demand once env is supplied.
  output: 'standalone',
  // turndown (HTML→Markdown for the WordPress importer) ships its own Node DOM shim;
  // keep it external so the bundler doesn't rewrite that dynamic require.
  serverExternalPackages: ['turndown', 'turndown-plugin-gfm'],
  // Client Router Cache kept minimal: every navigation reflects current server
  // state, so an edit is never hidden behind a stale client-side RSC. The server
  // still serves fast — public pages are ISR-cached (revalidate), so TTFB stays
  // low; this only forces the *client* to refetch that cached RSC. Reliability
  // over a few KB of refetch.
  // NOTE: Next 16 rejects `static: 0` (min 30) and silently ignores it, which
  // left static routes on the ~5min default. 30 is the lowest value Next accepts.
  experimental: {
    staleTimes: { dynamic: 0, static: 30 },
    // Cross-fade client navigations via the View Transitions API (CSS-only, tied to
    // the motion tokens in globals.css). Progressive: browsers without support just
    // cut as before. No render-blocking, no added client bundle.
    viewTransition: true,
  },
  // Baseline security headers on every route. HSTS is best set at the TLS edge
  // (reverse proxy / CDN); these cover clickjacking, MIME sniffing, referrer leakage,
  // and feature access. The CSP here is the SAFE, no-fallback subset that can be
  // enforced without nonces — it clamps embedding, plugins, `<base>` and form targets
  // but deliberately sets NO default-src/script-src/style-src (those would break the
  // inline theme/no-FOUC scripts). A full script-src+nonce CSP needs per-request
  // middleware injection and a Report-Only rollout — tracked as a follow-up.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
      {
        // Agent discovery (RFC 8288) on the homepage: point crawlers/agents at the
        // machine surfaces (API catalog + MCP card) and the content feeds without
        // parsing HTML. Relations are IANA-registered (api-catalog RFC 9727,
        // service-desc/service-doc RFC 8631) so a generic agent understands them.
        source: '/',
        headers: [
          {
            key: 'Link',
            value: [
              '</.well-known/api-catalog>; rel="api-catalog"',
              '</.well-known/mcp/server-card.json>; rel="service-desc"',
              '</llms.txt>; rel="service-doc"',
              '</sitemap.xml>; rel="sitemap"',
              '</feed.xml>; rel="alternate"; type="application/rss+xml"',
            ].join(', '),
          },
        ],
      },
    ]
  },
  // Markdown for Agents: when a client sends `Accept: text/markdown`, serve a
  // single-segment content URL (`/:slug` = a post or page) as its raw Markdown
  // instead of HTML — the content is authored in Markdown, so this is the source,
  // not a lossy conversion. A browser (Accept: text/html) is unaffected; the URL
  // stays the same (internal rewrite, not a redirect).
  async rewrites() {
    return [
      {
        source: '/:slug',
        has: [{ type: 'header', key: 'accept', value: '.*text/markdown.*' }],
        destination: '/api/md/:slug',
      },
    ]
  },
}

export default nextConfig
