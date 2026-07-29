// A bar across the top while the next page is on its way.
//
// The public site is server-rendered HTML, so a navigation is a real page load: the browser
// shows its own spinner in the tab and the page being left just sits there, looking like
// nothing happened. On a slow connection that is the whole of "did my tap register".
//
// Deliberately NOT a router. Nothing is intercepted and nothing is fetched — the click goes
// to the browser exactly as before, and this only marks the document so the stylesheet can
// draw the bar (`islands.css.ts`, `html[data-navigating]`). The bar dies with its page.
//
// Written to a byte budget, because it lives in `core.js`, which every listing pays for.
// The delay is the one piece of cleverness worth its size: `speculation-rules` prerenders on
// hover, so a large share of navigations finish in a few milliseconds, and a bar that
// appeared for one frame each time would read as a flicker rather than as progress.
const DELAY_MS = 150

export function navProgress(): void {
  const root = document.documentElement
  let timer: ReturnType<typeof setTimeout> | undefined

  const start = (): void => {
    clearTimeout(timer)
    timer = setTimeout(() => root.setAttribute('data-navigating', ''), DELAY_MS)
  }

  addEventListener('click', (e) => {
    const me = e as MouseEvent
    if (me.defaultPrevented || me.button || me.metaKey || me.ctrlKey || me.shiftKey || me.altKey) return
    const a = (e.target as Element | null)?.closest?.('a') as HTMLAnchorElement | null
    const href = a?.getAttribute('href')
    // A same-page anchor, a new tab and a download are all not navigations away.
    if (!href || href[0] === '#' || a!.target === '_blank' || a!.hasAttribute('download')) return
    if (a!.origin === location.origin) start()
  }, { capture: true })

  // The search and subscribe forms are navigations too.
  addEventListener('submit', start, { capture: true })

  // Covers a restore from the back/forward cache, where the document is the one that set the
  // attribute on its way out and would otherwise come back still wearing it. Also the only
  // thing that clears a navigation the reader aborted.
  addEventListener('pageshow', () => {
    clearTimeout(timer)
    root.removeAttribute('data-navigating')
  })
}
