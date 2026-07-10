// The sidebar's contents: a heading plus a list of links. One component serves
// both surfaces — the desktop rail in the left gutter and the mobile header menu
// — so the two can never drift apart.
import Link from 'next/link'

export type IndexLink = {
  href: string
  label: string
  count?: number // categories show a post count; tags do not
}

export function IndexBlock({ title, links }: { title: string; links: IndexLink[] }) {
  if (links.length === 0) return null
  return (
    <div>
      <h2 className="mb-3 pl-3.5 t-small font-semibold text-heading">{title}</h2>
      <ul>
        {links.map((l) => (
          <li key={l.href} className="mt-2 first:mt-0">
            <Link
              href={l.href}
              className="rail-row link-accent flex justify-between gap-4 t-small text-meta hover:text-heading"
            >
              <span>{l.label}</span>
              {/* Fixed-width and right-aligned: otherwise a two-digit count pushes
                  its label left and the names stop lining up. */}
              {l.count != null && <span className="rail-count shrink-0 tabular-nums">{l.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Tags are many and short: a wrapped run of plain words, no chips, no boxes.
export function TagCloud({ title, links }: { title: string; links: IndexLink[] }) {
  if (links.length === 0) return null
  return (
    <div>
      <h2 className="mb-3 pl-3.5 t-small font-semibold text-heading">{title}</h2>
      <div className="rail-tags flex flex-wrap gap-x-3 gap-y-1 pl-3.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="link-accent t-small text-meta hover:text-heading"
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}

// Categories + tags, the post-list sidebar. Rendered in the rail on wide screens
// and inside the header menu on narrow ones.
export function SideIndex({
  categories,
  tags,
  categoriesTitle,
  tagsTitle,
}: {
  categories: IndexLink[]
  tags: IndexLink[]
  categoriesTitle: string
  tagsTitle: string
}) {
  if (categories.length === 0 && tags.length === 0) return null
  return (
    <div className="space-y-7">
      <IndexBlock title={categoriesTitle} links={categories} />
      <TagCloud title={tagsTitle} links={tags} />
    </div>
  )
}
