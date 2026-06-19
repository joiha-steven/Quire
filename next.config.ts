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
  // Client Router Cache tuning:
  // - dynamic: 0  -> list pages (home/category/tag, which read searchParams) are
  //   never reused stale, so an edit/delete shows immediately on navigation.
  // - static: 180 -> post/page detail (prerendered SSG) is reused for 3 min, so
  //   hover/viewport prefetch makes clicking a post open instantly. Server-side
  //   edits still bust it via revalidatePath; the editor's "Xem bài viết" opens
  //   a fresh tab, so the owner never sees a stale post.
  experimental: {
    staleTimes: { dynamic: 0, static: 180 },
  },
}

export default nextConfig
