// A list of posts, as a whole page: the shell around `renderListing`, and the decision
// about whether the list is paginated or one continuous timeline.
//
// Split out of `app.ts` when the sidebar landed and pushed that file past 400 lines. The
// router keeps the routing; this keeps what a listing page IS.

import type { SiteSettings } from '@/types'
import { getSettings, resolveSiteUrl } from '@/content/settings'
import { paginate } from '@/content/paginate'
import { pageCache } from '@/server/cache'
import { renderDocument, pageStyles } from '@/web/layout'
import { PUBLIC_CSS } from '@/web/public.css'
import { renderListing, type ListingView } from '@/web/listing'
import { renderSidebar } from '@/web/sidebar'
import { timelineCss } from '@/render/rail-css'
import { ogCardUrl, siteDomain } from '@/render/og'
import { chromeLabels, siteFooter, siteHeader } from '@/web/chrome'
import { getMailStatus } from '@/news/mail'
import { scriptTag } from '@/web/assets'

type Posts = ListingView['paged']['items']

export type ListingPage = {
  title: string
  body: string
  canonicalPath?: string
  cardTitle?: string
  /** A category or tag page marks its own row in the rail. */
  activeHref?: string
  /** Extra geometry this page needs: the gutter timeline. */
  css?: string
}

/** Wrap listing markup in the site shell. Shared by home, taxonomy, series and search. */
export async function listingPage(
  { title, body, canonicalPath, cardTitle, activeHref, css = '' }: ListingPage,
): Promise<string> {
  const settings = await getSettings()
  const site = resolveSiteUrl(settings)
  const [{ configured: mailConfigured }, sidebar] = await Promise.all([
    getMailStatus(), renderSidebar(settings, activeHref),
  ])
  return renderDocument(
    settings,
    {
      title,
      description: settings.description,
      canonical: site && canonicalPath !== undefined ? `${site}${canonicalPath}` : undefined,
      // A listing card is two explicit lines rather than a post's title/excerpt/date.
      // Home reads as domain over description; a term page as its name over the domain.
      image: ogCardUrl(settings, site, cardTitle === undefined
        ? { title: siteDomain(site), site: settings.description }
        : { title: cardTitle, site: siteDomain(site) }),
    },
    pageStyles(settings, PUBLIC_CSS, [css, sidebar.css].filter(Boolean).join('\n')),
    // The rail is rendered LAST inside `main`: it is absolutely placed, so DOM order is
    // free, and this way the page heading still leads the document outline.
    `<div class="wrap">
${siteHeader(settings, { mailConfigured })}
<div class="with-rail"><main id="content">${body}${sidebar.html}</main></div>
${siteFooter(settings, { mailConfigured })}
</div>`,
    // `core` carries the analytics beacon AND the header's controls, all of which are on
    // every public page. A pageview that only fired on posts would undercount the home
    // page and every listing, which between them are most of a blog's traffic.
    { bodyData: chromeLabels(settings), scripts: scriptTag('core') },
  )
}

/**
 * A feed of posts: the home page and every taxonomy archive.
 *
 * With `features.infiniteScroll` on there is no pagination at all — the whole list is one
 * year-grouped timeline and a deep page number is a 404, because it would be duplicate
 * content under a URL the site does not link to. That is the frozen tree's behaviour, and
 * it is why the fetch-based infinite-scroll island was deleted: there is no next page.
 *
 * Returns null when the page number does not exist, which the router turns into a 404.
 */
export async function renderFeedBody(
  posts: Posts, page: number, view: Omit<ListingView, 'paged' | 'timeline'>,
): Promise<{ body: string; css: string } | null> {
  const settings: SiteSettings = await getSettings()
  const timeline = settings.features.infiniteScroll
  if (timeline && page > 1) return null
  const paged = timeline
    ? { items: posts, page: 1, totalPages: 1 }
    : paginate(posts, page, settings.postsPerPage)
  // `paginate` CLAMPS an out-of-range page, so an emptiness check never fires: /page/9
  // would silently serve the last page under a ninth URL, which is duplicate content at
  // every number a crawler tries. Compare against the real total instead.
  if (page > paged.totalPages) return null
  return {
    body: renderListing({ ...view, paged, timeline }, settings),
    // The timeline appears at a MUCH lower width than the sidebar: a date label needs far
    // less gutter than a 250px rail, so it shows on an ordinary laptop.
    css: timeline ? timelineCss(settings.contentWidth) : '',
  }
}

/** Serve an HTML route from the page cache, so the cache rule lives in ONE place. */
export function cached(key: string, render: () => Promise<string | null>) {
  return async (): Promise<Response> => {
    const hit = pageCache.get(key)
    if (hit !== undefined) {
      return new Response(hit, { headers: { 'content-type': 'text/html; charset=utf-8' } })
    }
    const html = await render()
    if (html === null) return new Response('Not found', { status: 404 })
    pageCache.set(key, html)
    return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
  }
}
