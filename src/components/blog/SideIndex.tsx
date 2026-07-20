// The sidebar's contents: a heading plus a list of links. One component serves
// both surfaces — the desktop rail in the left gutter and the mobile header menu
// — so the two can never drift apart.
import Link from 'next/link'

export type IndexLink = {
  href: string
  label: string
  count?: number // categories show a post count; tags do not
}

export function IndexBlock({ title, links, activeHref }: { title: string; links: IndexLink[]; activeHref?: string }) {
  if (links.length === 0) return null
  // Widest count on this list, in digits — the count column is sized to exactly that.
  const digits = Math.max(1, ...links.map((l) => (l.count == null ? 1 : String(l.count).length)))
  return (
    <div>
      <h2 className="mb-3 pl-3.5 t-small font-semibold text-heading">{title}</h2>
      <ul style={{ '--count-w': `${digits}ch` } as React.CSSProperties}>
        {links.map((l) => (
          <li key={l.href} className="mt-2 first:mt-0">
            <Link
              href={l.href}
              aria-current={l.href === activeHref ? 'page' : undefined}
              className={`rail-row link-accent flex justify-between gap-3.5 t-small hover:text-heading ${
                l.href === activeHref ? 'font-medium text-heading' : 'text-meta'
              }`}
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

// Categories, condensed like tags: a wrapped run of words (no vertical list) so a long
// list stays compact, but each keeps its post count as a small trailing number.
export function CategoryCloud({ title, links, activeHref }: { title: string; links: IndexLink[]; activeHref?: string }) {
  if (links.length === 0) return null
  return (
    <div>
      <h2 className="mb-3 pl-3.5 t-small font-semibold text-heading">{title}</h2>
      <div className="rail-tags flex flex-wrap gap-x-3 gap-y-1 pl-3.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === activeHref ? 'page' : undefined}
            className={`link-accent t-small hover:text-heading ${
              l.href === activeHref ? 'font-medium text-heading underline decoration-accent underline-offset-4' : 'text-meta'
            }`}
          >
            {l.label}
            {l.count != null && <span className="ml-1 text-[0.85em] opacity-60 tabular-nums">({l.count})</span>}
          </Link>
        ))}
      </div>
    </div>
  )
}

// Tags are many and short: a wrapped run of plain words, no chips, no boxes.
export function TagCloud({ title, links, activeHref }: { title: string; links: IndexLink[]; activeHref?: string }) {
  if (links.length === 0) return null
  return (
    <div>
      <h2 className="mb-3 pl-3.5 t-small font-semibold text-heading">{title}</h2>
      <div className="rail-tags flex flex-wrap gap-x-3 gap-y-1 pl-3.5">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === activeHref ? 'page' : undefined}
            className={`link-accent t-small lowercase hover:text-heading ${
              l.href === activeHref ? 'font-medium text-heading underline decoration-accent underline-offset-4' : 'text-meta'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
