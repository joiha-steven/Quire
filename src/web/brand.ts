// The Quire mark.
//
// The sign-in screens carry the SOFTWARE's identity, not the blog's. That is a reversal of
// what 06-auth.md originally specified ("the site's own masthead"), decided by the owner
// after seeing the page: a reader never reaches /login, so the only person it speaks to is
// the one signing in to Quire, and every install should show them the same door.
//
// It is an inline SVG rather than a file because it is 300 bytes, it must inherit
// `currentColor` so it survives a palette change and dark mode, and a logo that arrives on
// its own request can arrive late — on the one page where "did this load?" is a security
// question.
//
// The shape is what the word means: a quire is a gathering of folded sheets. Two leaves and
// the fold between them, drawn in the same stroke idiom as the rest of the icon set
// (24-grid geometry, `fill=none`, round joins), so it sits beside them without looking
// borrowed.

/** The mark alone, at `size` px. Inherits colour from its parent. */
export function quireMark(size = 34): string {
  return `<svg class="brand-mark" width="${size}" height="${size}" viewBox="0 0 32 32" fill="none" `
    + `stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" `
    + `aria-hidden="true" focusable="false">`
    + `<path d="M16 8.2C13.4 6.5 9.9 5.5 6 5.5v17c3.9 0 7.4 1 10 2.7 2.6-1.7 6.1-2.7 10-2.7v-17c-3.9 0-7.4 1-10 2.7Z"/>`
    + `<path d="M16 8.2v17"/>`
    + `</svg>`
}

/**
 * Mark plus wordmark, as one block.
 *
 * Not a link. The sign-in page has exactly one thing to do, and a logo that navigates away
 * from it is a way to lose your place; the way back to the site is a plain link at the
 * bottom, where leaving belongs.
 */
export function quireLockup(): string {
  return `<div class="brand">${quireMark()}<span class="brand-word">Quire</span></div>`
}
