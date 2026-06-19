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
  // Don't reuse the client-side Router Cache across navigations: an edit/delete
  // must show immediately when clicking back to a list. Data freshness comes
  // from revalidateTag; this just stops the browser holding a stale RSC payload.
  experimental: {
    staleTimes: { dynamic: 0, static: 0 },
  },
}

export default nextConfig
