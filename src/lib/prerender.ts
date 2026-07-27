// Speculation Rules (root layout) let Chrome PRERENDER the next page on hover. A
// prerendered document runs its JavaScript immediately, at speculation time — so any
// analytics beacon that fires on mount would record a view for a page the reader may
// never open, and a dwell timer started then would count the wait as reading time.
//
// `whenActivated` defers work until the document is really being viewed: it runs the
// callback now on a normal load, and on `prerenderingchange` (fired once, when the
// user actually navigates) inside a prerendered one. A prerendered document that is
// discarded never activates, so the callback never runs and nothing is recorded.
//
// Client-only: `document` is touched at call time, never at import time.
export function whenActivated(run: () => void): () => void {
  // `document.prerendering` is a Chrome-only flag; everywhere else this is a plain call.
  if (typeof document === 'undefined' || !(document as Document & { prerendering?: boolean }).prerendering) {
    run()
    return () => {}
  }
  document.addEventListener('prerenderingchange', run, { once: true })
  return () => document.removeEventListener('prerenderingchange', run)
}
