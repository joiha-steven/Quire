import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
    ],
  },
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
  // Baseline security headers on every route. HSTS is added by Vercel; these
  // cover clickjacking, MIME sniffing, referrer leakage, and feature access.
  // No CSP here on purpose: the app loads inline theme/no-FOUC scripts, Vercel
  // Analytics, OG (edge), and Blob images — a strict CSP needs nonces + a
  // Report-Only rollout first, so it is left out rather than shipped broken.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ]
  },
}

export default nextConfig
