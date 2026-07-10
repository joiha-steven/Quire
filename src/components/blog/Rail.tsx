// The left-gutter rail. Absolutely placed inside the layout's `.with-rail` box,
// so it never displaces the reading column: with or without a rail, the column
// sits in the same place. Hidden below the breakpoint the layout computes from
// `contentWidth` — on narrow screens the same content rides in the header menu.
export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <aside className="rail">
      <div className="rail-inner">{children}</div>
    </aside>
  )
}
