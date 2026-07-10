// The post-list sidebar: categories (with published-post counts) + tags in the
// left gutter of EVERY listing page (home, home page N, category, tag, and their
// deeper pages), gated by `features.sidebar`. On a category/tag page the row you
// are viewing carries the accent mark. Below the rail breakpoint it is the drawer.
import { getPublicTaxonomy } from '@/lib/posts'
import { termSlug } from '@/lib/taxonomy'
import { t } from '@/lib/i18n'
import type { SiteLang } from '@/types'
import { Rail } from './Rail'
import { SideIndex } from './SideIndex'

export async function ListingSidebar({ lang, activeHref }: { lang: SiteLang; activeHref?: string }) {
  const { categories, tags } = await getPublicTaxonomy()
  if (categories.length === 0 && tags.length === 0) return null
  const labels = t(lang)
  return (
    <Rail label={labels.categoriesTitle}>
      <SideIndex
        categoriesTitle={labels.categoriesTitle}
        tagsTitle={labels.tagsTitle}
        categories={categories.map((c) => ({ href: `/category/${termSlug(c.name)}`, label: c.name, count: c.count }))}
        tags={tags.map((tag) => ({ href: `/tag/${termSlug(tag.name)}`, label: tag.name }))}
        activeHref={activeHref}
      />
    </Rail>
  )
}
