// The sidebar. On wide screens it is a left- (or, for a listing page's second rail, right-)
// gutter rail: absolutely placed inside the layout's `.with-rail` box, so it never displaces
// the reading column. Below the breakpoint the same DOM is a slide-out drawer opened by the
// header menu button (RailToggle) via <html data-rail>. `className` = an optional rail
// variant (`rail-left` / `rail-right`) that the injected geometry positions per gutter.
export function Rail({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <aside className={`rail ${className}`.trim()}>
      <div className="rail-inner">{children}</div>
    </aside>
  )
}
