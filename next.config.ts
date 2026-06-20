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
  // Client Router Cache fully OFF (both 0): every navigation reflects the current
  // server state, so an edit is never hidden behind a stale client-side RSC. The
  // server still serves fast — public pages are ISR-cached (revalidate), so TTFB
  // stays low for visitors; this only forces the *client* to refetch that cached
  // RSC instead of reusing an old copy. Reliability over a few KB of refetch.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
}

export default nextConfig
