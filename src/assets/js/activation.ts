// Its own module, deliberately: the bundler tree-shakes per module, not per export, so
// keeping this beside the DOM helpers put it in `post.js` too, where nothing calls it.
// 182 bytes is not much, but the article page's JavaScript budget is a number in a test,
// and a number nobody defends stops being a budget.

/**
 * Speculation Rules let Chrome PRERENDER the next page on hover. A prerendered document
 * runs its JavaScript immediately, at speculation time, so an analytics beacon that fires
 * on load would record a view for a page the reader may never open, and a dwell timer
 * started then would count the wait as reading time.
 *
 * `whenActivated` defers work until the document is really being viewed: it runs now on a
 * normal load, and on `prerenderingchange` (fired once, when the reader actually
 * navigates) inside a prerendered one. A discarded prerender never activates, so the
 * callback never runs and nothing is recorded.
 */
export function whenActivated(run: () => void): () => void {
  // `document.prerendering` is Chrome-only; everywhere else this is a plain call.
  if (!(document as Document & { prerendering?: boolean }).prerendering) {
    run()
    return () => {}
  }
  document.addEventListener('prerenderingchange', run, { once: true })
  return () => document.removeEventListener('prerenderingchange', run)
}
