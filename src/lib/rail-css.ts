// Rail geometry as CSS strings, injected at runtime because a media query can't read a
// CSS variable — the breakpoint is COMPUTED from the reading-column width. Shared by the
// blog layout (single left ToC rail, post/default width) and the listing sidebar (TWO
// rails + a narrower column). Keep in sync with globals.css `.rail` base + `--rail-*`.
//
// The column width is exposed as `--shell-w` (the layout's shell reads it, falling back to
// the owner's contentWidth). Listing pages set a narrower `--shell-w` AND emit the two-rail
// rules; because those use the higher-specificity `.rail.rail-left` / `.rail.rail-right`
// selectors, they win over the layout's single-rail `.rail` rules with no ordering games.

export const RAIL_W = 250
export const RAIL_GAP = 40
export const RAIL_PAD = 14
export const RAIL_BREATHING = 10 // clear space between a rail and the viewport edge

// Viewport width at which BOTH gutters can hold a rail (keeps the column centred).
function breakpoint(colWidth: number): number {
  return colWidth + 2 * (RAIL_W + RAIL_GAP + RAIL_BREATHING)
}

const DIVIDER = (RAIL_GAP - RAIL_PAD) / 2
const GUTTER =
  'position:absolute;inset:auto auto auto auto;top:var(--rail-top);width:var(--rail-w);' +
  'height:calc(100% - var(--rail-top));padding:0;background:none;border:0;overflow:visible;transform:none;display:block'
const INNER =
  '.rail-inner{max-height:calc(100dvh - 2.5rem - 1.5rem);overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}'

// Single left-gutter rail (post ToC + the default). Text ranged RIGHT toward the column;
// the freed right gutter lets a "large" image nose right by one rail width.
export function singleRailCss(colWidth: number): string {
  const at = breakpoint(colWidth)
  return (
    `@media (min-width:${at}px){` +
    `.rail{${GUTTER};right:calc(100% + var(--rail-gap));left:auto;text-align:right}` +
    `.rail::after{content:"";position:absolute;top:0;bottom:0;right:-${DIVIDER}px;width:1px;background:var(--c-rule)}` +
    INNER +
    `.rail h2,.rail .rail-tags{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail .rail-tags{justify-content:flex-end}` +
    `.rail li a{justify-content:flex-end}` +
    `.rail-row{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail-row[aria-current]::before{left:auto;right:0}` +
    `.rail-toggle,.rail-scrim{display:none}` +
    // A "wide" image or video noses right into the freed gutter by one rail width.
    `.prose figure.img-wide,.prose .video-wide{width:calc(100% + var(--rail-w) + var(--rail-gap));max-width:none;margin-left:0;` +
    `margin-right:calc(-1 * (var(--rail-w) + var(--rail-gap)))}}`
  )
}

// Infinite-scroll timeline. NOT a boxed rail: a spine runs the full height of the feed in
// the RIGHT gutter, and each year's marker is absolutely positioned beside the FIRST post
// of that year — so the years line up with the posts on the left and the whole thing scrolls
// with the page, with no JS and no measurement (the marker flows with its card). Desktop
// only: below the breakpoint there is no gutter, so markers + spine are hidden.
export function timelineCss(colWidth: number): string {
  const at = breakpoint(colWidth)
  return (
    `.tl-mark{display:none}` +
    `@media (min-width:${at}px){` +
    // Spine: a line down the right gutter, exactly as tall as the post list.
    `.post-list{position:relative}` +
    `.post-list::after{content:"";position:absolute;top:0;bottom:0;left:calc(100% + var(--rail-gap) + 3.5px);width:1px;background:var(--c-rule)}` +
    // Marker: a child of a month/year's first card, anchored to the card top out in the gutter.
    `.post-list article{position:relative}` +
    `.post-list article .tl-mark{display:flex;position:absolute;top:0;left:calc(100% + var(--rail-gap));width:var(--rail-w)}` +
    // Grid view is an alternate layout (cards in 2 columns) — the gutter timeline can't align, so drop it.
    `html[data-list=grid] .post-list::after,html[data-list=grid] .tl-mark{display:none}}`
  )
}

// Grid mode for a listing page (header toggle → <html data-list=grid>) needs no extra CSS:
// the base 1/2-column grid (globals.css) applies at every width, in-column, so the grid keeps
// the same reading-column width as the list and caps at 2 columns. No gutter widening, no
// 3-column desktop layout, no rail hiding.

// Two rails for listing pages: LEFT (discovery, ranged right toward the column) + RIGHT
// (nav, mirrored: ranged left toward the column, divider + marker on the left). Also sets
// the narrower `--shell-w` and hides the drawer-only duplicate above the breakpoint.
export function listingRailCss(colWidth: number): string {
  const at = breakpoint(colWidth)
  return (
    `:root{--shell-w:${colWidth}px}` +
    `@media (min-width:${at}px){` +
    // Left rail — discovery.
    `.rail.rail-left{${GUTTER};right:calc(100% + var(--rail-gap));left:auto;text-align:right}` +
    `.rail.rail-left::after{content:"";position:absolute;top:0;bottom:0;right:-${DIVIDER}px;width:1px;background:var(--c-rule)}` +
    `.rail.rail-left h2,.rail.rail-left .rail-tags{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail.rail-left .rail-tags{justify-content:flex-end}` +
    `.rail.rail-left li a{justify-content:flex-end}` +
    `.rail.rail-left .rail-row{padding-left:0;padding-right:var(--rail-pad)}` +
    `.rail.rail-left .rail-row[aria-current]::before{left:auto;right:0}` +
    // Right rail — nav, mirrored.
    `.rail.rail-right{${GUTTER};left:calc(100% + var(--rail-gap));right:auto;text-align:left}` +
    `.rail.rail-right::after{content:"";position:absolute;top:0;bottom:0;left:-${DIVIDER}px;width:1px;background:var(--c-rule)}` +
    `.rail.rail-right h2,.rail.rail-right .rail-tags{padding-right:0;padding-left:var(--rail-pad)}` +
    `.rail.rail-right .rail-tags{justify-content:flex-start}` +
    `.rail.rail-right li a{justify-content:flex-start}` +
    `.rail.rail-right .rail-row{padding-right:0;padding-left:var(--rail-pad)}` +
    `.rail.rail-right .rail-row[aria-current]::before{right:auto;left:0}` +
    INNER +
    `.drawer-only{display:none}` +
    `.rail-toggle,.rail-scrim{display:none}}`
  )
}
