// The post-list sidebar: categories + tags in the left gutter. Gated by
// `features.sidebar` at the call site. Below the rail breakpoint it is hidden and
// the same index appears in the header menu (rendered by the blog layout).
import { getPublicTaxonomy } from '@/lib/posts'
import { termSlug } from '@/lib/taxonomy'
import { t } from '@/lib/i18n'
import type { SiteLang } from '@/types'
import { Rail } from './Rail'
import { SideIndex } from './SideIndex'

export async function HomeRail({ lang }: { lang: SiteLang }) {
  const { categories, tags } = await getPublicTaxonomy()
  const labels = t(lang)
  if (categories.length === 0 && tags.length === 0) return null
  return (
    <Rail label={labels.categoriesTitle}>
      <SideIndex
        categoriesTitle={labels.categoriesTitle}
        tagsTitle={labels.tagsTitle}
        categories={categories.map((c) => ({ href: `/category/${termSlug(c.name)}`, label: c.name, count: c.count }))}
        tags={tags.map((tag) => ({ href: `/tag/${termSlug(tag.name)}`, label: tag.name }))}
      />
    </Rail>
  )
}
