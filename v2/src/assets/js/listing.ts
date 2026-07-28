// The one thing a reader can do to a list of posts: change its shape.
//
// Opt-in per site (`features.gridView`) and self-guarding on markup, so on a site with it
// switched off this file does one failed query and stops.
//
// Infinite scroll used to live here too, as a fetch of the next page's HTML. It does not
// any more: a site with `features.infiniteScroll` on has no pagination at all — the feed is
// one year-grouped timeline and `/page/2` is a 404, exactly as in the frozen tree — so
// there was no next page left to fetch. Scroll reveal is now the CSS `reveal` animation.

import { label } from './dom'

const STORE_KEY = 'quire:list'

/**
 * List or grid, remembered.
 *
 * KNOWN COST, and it is a real one: the frozen tree applied the saved choice with a
 * pre-paint inline script, so a reader who chose grid never saw the list. 2.0 has no inline
 * script anywhere — that property is tested, and the article page's script count is a
 * number in an assertion — so the attribute is applied when `core.js` runs, and a grid
 * reader may see one frame of list first.
 *
 * The alternatives were both worse. An inline script would be the only one on the site. A
 * cookie would let the server render it, but the page cache is keyed by URL alone
 * (Invariant 1), so a cached page would carry whichever mode the first visitor had.
 */
function gridToggle(): void {
  const button = document.querySelector<HTMLButtonElement>('[data-grid-toggle]')
  if (!button) return

  // Nothing to toggle on a page with no list: a reading view, /search, a 404.
  if (!document.querySelector('.post-list')) {
    button.hidden = true
    return
  }

  const apply = (grid: boolean) => {
    document.documentElement.dataset.list = grid ? 'grid' : 'list'
    button.setAttribute('aria-pressed', String(grid))
    button.setAttribute('aria-label', label(grid ? 'listView' : 'gridView'))
  }

  let grid = false
  try {
    grid = localStorage.getItem(STORE_KEY) === 'grid'
  } catch {
    /* storage can be denied; the default is then simply not remembered */
  }
  apply(grid)

  button.addEventListener('click', () => {
    grid = !grid
    apply(grid)
    try {
      localStorage.setItem(STORE_KEY, grid ? 'grid' : 'list')
    } catch {
      /* ignore */
    }
  })
}

export function listing(): void {
  gridToggle()
}
