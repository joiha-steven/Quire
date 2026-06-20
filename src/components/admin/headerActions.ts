// Shared styling for the admin header's right-side action cluster (theme,
// clear-cache, sign-out). Every item imports the SAME string, so they can never
// drift in height/shape/text-size/colour again — fix the look here once.
//
// RULE: a new header action must reuse one of these. Do NOT hand-roll per-button
// classes — that is exactly what made the cluster uneven.

// Text action (clear-cache, sign-out): h-10, horizontal padding, small muted text
// matching the left nav links. `disabled:opacity-50` covers busy states. The
// theme toggle is a separate h-10 w-10 icon button (shared with the public header)
// and is intentionally left out of here.
export const HEADER_ACTION =
  'flex h-10 items-center rounded-lg px-3 text-sm text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 disabled:opacity-50 dark:text-neutral-300 dark:hover:bg-neutral-800 dark:hover:text-white'
