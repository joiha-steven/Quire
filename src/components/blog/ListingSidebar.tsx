// The MAIN (listing) sidebar. On desktop it is TWO gutter rails flanking a narrower reading
// column: LEFT = discovery (most viewed + featured), RIGHT = navigation (menu + categories +
// tags). On mobile there is one gutter-less drawer, so the left rail is hidden and its two
// discovery blocks are duplicated into the right rail's drawer (`.drawer-only`, desktop-
// hidden) — giving the mobile order menu → most viewed → featured → categories → tags.
// Gated by `features.sidebar`; a category/tag page marks the active row. Post/page reading
// views use their own single ToC rail (see [slug]/page.tsx), not this.
import { getPublicTaxonomy, getPublicPosts } from '@/lib/posts'
import { getViewTotals } from '@/lib/analytics'
import { getSettings } from '@/lib/settings'
import { termSlug } from '@/lib/taxonomy'
import { t } from '@/lib/i18n'
import { listingRailCss, listingGridCss } from '@/lib/rail-css'
import type { SiteLang } from '@/types'
import { Rail } from './Rail'
import { IndexBlock, TagCloud } from './SideIndex'
import { SidebarMenu } from './SidebarMenu'

const FEATURED_MAX = 5 // curated posts shown in the "Featured" block
const LISTING_WIDTH_RATIO = 0.8 // listing column = 80% of the post/reading width

export async function ListingSidebar({ lang, activeHref }: { lang: SiteLang; activeHref?: string }) {
  const [{ categories, tags }, { featured: featuredSlugs, menu, mostViewedCount, contentWidth, sidebarLayout }, posts, viewTotals] = await Promise.all([
    getPublicTaxonomy(),
    getSettings(),
    getPublicPosts(),
    getViewTotals(),
  ])
  const titleBySlug = new Map(posts.map((p) => [p.slug, p.title]))

  // Most viewed: public posts ranked by all-time views (viewTotals keyed by path "/slug");
  // count is owner-set (`mostViewedCount`, 0 hides the block).
  const mostViewed = posts
    .map((p) => ({ slug: p.slug, title: p.title, views: viewTotals[`/${p.slug}`] ?? 0 }))
    .filter((p) => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, mostViewedCount)
    .map((p) => ({ href: `/${p.slug}`, label: p.title }))

  // Featured: owner order, keeping only slugs that are currently public.
  const featured = featuredSlugs
    .filter((slug) => titleBySlug.has(slug))
    .slice(0, FEATURED_MAX)
    .map((slug) => ({ href: `/${slug}`, label: titleBySlug.get(slug) ?? '' }))

  const empty = menu.length === 0 && categories.length === 0 && mostViewed.length === 0 && featured.length === 0 && tags.length === 0
  if (empty) return null

  const labels = t(lang)
  const categoryLinks = categories.map((c) => ({ href: `/category/${termSlug(c.name)}`, label: c.name, count: c.count }))
  const tagLinks = tags.map((tag) => ({ href: `/tag/${termSlug(tag.name)}`, label: tag.name }))
  const discovery = (
    <>
      <IndexBlock title={labels.mostViewedTitle} links={mostViewed} activeHref={activeHref} />
      <IndexBlock title={labels.featuredTitle} links={featured} activeHref={activeHref} />
    </>
  )
  const nav = (
    <>
      <IndexBlock title={labels.categoriesTitle} links={categoryLinks} activeHref={activeHref} />
      <TagCloud title={labels.tagsTitle} links={tagLinks} activeHref={activeHref} />
    </>
  )

  // Single-column (default): one left rail, everything stacked, full-width column. The
  // grid toggle widens into the free right gutter (listingGridCss, keyed to this width).
  if (sidebarLayout !== 'two') {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: listingGridCss(contentWidth) }} />
        <Rail>
          <div className="space-y-7">
            <SidebarMenu items={menu} />
            {discovery}
            {nav}
          </div>
        </Rail>
      </>
    )
  }

  // Two-column: discovery-left + nav-right rails; narrower column via listingRailCss.
  const listingWidth = Math.round(contentWidth * LISTING_WIDTH_RATIO)
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: listingRailCss(listingWidth) + listingGridCss(listingWidth) }} />
      {/* LEFT rail — discovery (desktop gutter only; hidden on mobile). */}
      <Rail className="rail-left">
        <div className="space-y-7">{discovery}</div>
      </Rail>
      {/* RIGHT rail — navigation; also the mobile drawer (holds everything). */}
      <Rail className="rail-right">
        <div className="space-y-7">
          <SidebarMenu items={menu} />
          {/* Discovery again, shown ONLY in the mobile drawer (desktop-hidden). */}
          <div className="drawer-only space-y-7">{discovery}</div>
          {nav}
        </div>
      </Rail>
    </>
  )
}
