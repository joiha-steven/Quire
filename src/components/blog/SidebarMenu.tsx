// The site menu as the TOP block of the sidebar (rail) — moved out of the header. Rows
// reuse the taxonomy `rail-row` styling, so they range right in the desktop gutter and
// left in the mobile drawer with no per-surface handling. Internal links use next/link;
// external (http) use a plain anchor. Headingless: the nav leads the rail.
import Link from 'next/link'
import type { MenuItem } from '@/types'

const ROW = 'rail-row link-accent flex justify-between gap-3.5 t-small text-meta hover:text-heading'

export function SidebarMenu({ items }: { items: MenuItem[] }) {
  if (items.length === 0) return null
  return (
    <nav>
      <ul>
        {items.map((item, i) => (
          <li key={`${item.href}-${i}`} className="mt-2 first:mt-0">
            {/^https?:\/\//.test(item.href) ? (
              <a href={item.href} target="_blank" rel="noopener" className={ROW}>
                <span>{item.label}</span>
              </a>
            ) : (
              <Link href={item.href || '/'} className={ROW}>
                <span>{item.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </nav>
  )
}
