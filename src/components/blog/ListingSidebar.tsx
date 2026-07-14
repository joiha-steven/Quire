// The post-list sidebar: categories (with counts) + most-viewed + featured + tags,
// in the left gutter of EVERY listing page (home, home page N, category, tag, and
// their deeper pages), gated by `features.sidebar`. On a category/tag page the row you
// are viewing carries the accent mark. Below the rail breakpoint it is the drawer.
//   - Most viewed: automatic, top posts by all-time views.
//   - Featured: owner-curated (`settings.featured`), in that order — kept only while public.
import { getPublicTaxonomy, getPublicPosts } from '@/lib/posts'
import { getViewTotals } from '@/lib/analytics'
import { getSettings } from '@/lib/settings'
import { termSlug } from '@/lib/taxonomy'
import { t } from '@/lib/i18n'
import type { SiteLang } from '@/types'
import { Rail } from './Rail'
import { SideIndex } from './SideIndex'
import { SidebarMenu } from './SidebarMenu'

const LIST_MAX = 5 // rows shown per post block (most viewed / featured)

export async function ListingSidebar({ lang, activeHref }: { lang: SiteLang; activeHref?: string }) {
  const [{ categories, tags }, { featured: featuredSlugs, menu }, posts, viewTotals] = await Promise.all([
    getPublicTaxonomy(),
    getSettings(),
    getPublicPosts(),
    getViewTotals(),
  ])
  // Title lookup for the public posts; a featured/most-viewed slug not here is dropped.
  const titleBySlug = new Map(posts.map((p) => [p.slug, p.title]))

  // Most viewed: public posts ranked by all-time views (viewTotals keyed by path "/slug").
  const mostViewed = posts
    .map((p) => ({ slug: p.slug, title: p.title, views: viewTotals[`/${p.slug}`] ?? 0 }))
    .filter((p) => p.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, LIST_MAX)
    .map((p) => ({ href: `/${p.slug}`, label: p.title }))

  // Featured: owner order, keeping only slugs that are currently public.
  const featured = featuredSlugs
    .filter((slug) => titleBySlug.has(slug))
    .slice(0, LIST_MAX)
    .map((slug) => ({ href: `/${slug}`, label: titleBySlug.get(slug) ?? '' }))

  const empty = menu.length === 0 && categories.length === 0 && mostViewed.length === 0 && featured.length === 0 && tags.length === 0
  if (empty) return null
  const labels = t(lang)
  return (
    <Rail>
      <div className="space-y-7">
        <SidebarMenu items={menu} />
        <SideIndex
          categoriesTitle={labels.categoriesTitle}
          mostViewedTitle={labels.mostViewedTitle}
          featuredTitle={labels.featuredTitle}
          tagsTitle={labels.tagsTitle}
          categories={categories.map((c) => ({ href: `/category/${termSlug(c.name)}`, label: c.name, count: c.count }))}
          mostViewed={mostViewed}
          featured={featured}
          tags={tags.map((tag) => ({ href: `/tag/${termSlug(tag.name)}`, label: tag.name }))}
          activeHref={activeHref}
        />
      </div>
    </Rail>
  )
}
