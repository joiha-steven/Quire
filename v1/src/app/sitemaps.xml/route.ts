// Alias for the canonical sitemap. Some tools / old submissions use the plural
// `/sitemaps.xml`; permanently redirect them to `/sitemap.xml` so there is a
// single source of truth (no duplicate sitemap to keep in sync).
import { NextResponse, type NextRequest } from 'next/server'

export const revalidate = 3600

export function GET(req: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/sitemap.xml', req.url), 308)
}
