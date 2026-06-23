// Shown while a blog route segment loads (instant feedback on navigation). Renders
// inside the (blog) layout (header + centered column already there), so this is just
// the inner content placeholder. Themed faint blocks; the pulse follows the motion
// engine (see `.skeleton` in globals.css). Sized to roughly match a post so the swap
// to real content barely shifts.
export default function Loading() {
  return (
    <div className="py-4" aria-busy="true" aria-live="polite">
      {/* Title + meta */}
      <div className="skeleton h-9 w-3/4" />
      <div className="skeleton mt-4 h-4 w-40" />
      {/* Body lines */}
      <div className="mt-10 space-y-4">
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-11/12" />
        <div className="skeleton h-4 w-4/5" />
        <div className="skeleton mt-8 h-4 w-full" />
        <div className="skeleton h-4 w-full" />
        <div className="skeleton h-4 w-3/4" />
      </div>
    </div>
  )
}
