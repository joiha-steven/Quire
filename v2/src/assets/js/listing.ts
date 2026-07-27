// The two things a reader can do to a list of posts: change its shape, and keep reading.
//
// Both are opt-in per site (`features.gridView`, `features.infiniteScroll`) and both
// self-guard on markup, so on a site with neither turned on this file does two failed
// queries and stops.

import { el, label } from './dom'

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
  if (!document.querySelector('.listing')) {
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

/**
 * Load the next page in place when the reader reaches the bottom.
 *
 * No new endpoint: it fetches the next page's HTML and moves its cards across. That page
 * has to exist and be crawlable anyway, so this reuses it rather than adding a second
 * representation of the same list that could drift from the first.
 *
 * The pager stays in the DOM and keeps working. If a fetch fails, the reader has a link.
 */
function infiniteListing(): void {
  const listing = document.querySelector<HTMLElement>('.listing')
  const pager = document.querySelector<HTMLElement>('.pager')
  if (!listing || !pager || !('infinite' in document.body.dataset)) return

  let next = pager.querySelector<HTMLAnchorElement>('a[rel="next"]')?.href ?? ''
  if (!next) return
  let loading = false

  const sentinel = el('div', { class: 'listing-sentinel', 'aria-hidden': 'true' })
  listing.after(sentinel)

  const observer = new IntersectionObserver(async (entries) => {
    if (loading || !next || !entries.some((e) => e.isIntersecting)) return
    loading = true
    try {
      const res = await fetch(next)
      if (!res.ok) throw new Error(String(res.status))
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html')
      const cards = doc.querySelectorAll('.listing > .card')
      if (!cards.length) throw new Error('no cards')
      listing.append(...Array.from(cards))
      // The URL of the page just consumed becomes the history entry, so a reload lands
      // where the reader actually is rather than back at the top.
      history.replaceState(null, '', next)
      next = doc.querySelector<HTMLAnchorElement>('.pager a[rel="next"]')?.getAttribute('href') ?? ''
      if (!next) {
        observer.disconnect()
        sentinel.remove()
        pager.remove() // nothing left to page to
      }
    } catch {
      // Give up quietly and leave the pager alone: the reader still has a working link,
      // which is the whole reason it was not replaced by this in the first place.
      observer.disconnect()
      sentinel.remove()
    } finally {
      loading = false
    }
  }, { rootMargin: '600px' })
  observer.observe(sentinel)
}

export function listing(): void {
  gridToggle()
  infiniteListing()
}
