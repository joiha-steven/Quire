// The sidebar. On wide screens it is the left-gutter rail: absolutely placed inside the
// layout's `.with-rail` box, so it never displaces the reading column. Below the breakpoint
// the same DOM is a slide-out drawer opened by the header menu button (RailToggle) via
// <html data-rail> — one piece of markup, two presentations.
export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <aside className="rail">
      <div className="rail-inner">{children}</div>
    </aside>
  )
}
