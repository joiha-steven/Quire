// Line icons for the admin sidebar — one uniform style (viewBox 24, stroke 1.8,
// round caps, currentColor) so the rail reads as a single set. Sized by the caller.

const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const
const C = 'h-[18px] w-[18px] shrink-0'

export function IconHome() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}
export function IconAnalytics() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  )
}
export function IconContent() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M6 3h8l4 4v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
      <path d="M14 3v5h5M8.5 13h7M8.5 17h7" />
    </svg>
  )
}
export function IconMedia() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 5-5 4 4 3-3 4 4" />
    </svg>
  )
}
export function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
    </svg>
  )
}
export function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 0 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 4.7 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.6 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </svg>
  )
}
export function IconLog() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M3 12h4l2 5 4-12 2 5h6" />
    </svg>
  )
}
export function IconComment() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
export function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M14 4h6v6M20 4l-8 8" />
      <path d="M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5" />
    </svg>
  )
}
export function IconCache() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16M3 21v-5h5" />
    </svg>
  )
}

export function IconHelp() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.2a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1.1 .9-1.1 1.8" />
      <path d="M12 16.5h.01" />
    </svg>
  )
}
export function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5M21 12H9" />
    </svg>
  )
}
// Collapse/expand chevrons (caller rotates by state if desired).
export function IconChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" className={C} {...S} aria-hidden>
      <path d="m15 6-6 6 6 6" />
    </svg>
  )
}
