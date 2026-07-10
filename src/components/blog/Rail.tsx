// The sidebar. On wide screens it is the left-gutter rail: absolutely placed
// inside the layout's `.with-rail` box, so it never displaces the reading column.
// Below the breakpoint the same DOM is a slide-out drawer behind an edge handle
// (see globals.css + RailHandle) — one piece of markup, two presentations.
import { RailHandle } from './RailHandle'

export function Rail({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <>
      <RailHandle label={label} />
      <aside className="rail">
        <div className="rail-inner">{children}</div>
      </aside>
    </>
  )
}
