// Shared browser helpers. Bundled into every entry point, never served on its own.

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

/**
 * A label the server put on `<body>`. Every string a script shows a reader is translated
 * server-side and handed over as a data attribute, so the bundle carries no copy of the
 * locale table and no language of its own.
 */
export function label(name: string): string {
  return document.body.dataset[name] ?? ''
}

/** Create an element with attributes and children in one call. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v)
  node.append(...children)
  return node
}

/**
 * A scroll handler that reads layout, coalesced to one call per frame. Reading rects on
 * every scroll event forces a synchronous layout each time; this reads at most once per
 * paint.
 */
export function onScrollFrame(run: () => void): () => void {
  let queued = 0
  const handler = () => {
    if (queued) return
    queued = requestAnimationFrame(() => {
      queued = 0
      run()
    })
  }
  run()
  addEventListener('scroll', handler, { passive: true })
  addEventListener('resize', handler)
  return () => {
    cancelAnimationFrame(queued)
    removeEventListener('scroll', handler)
    removeEventListener('resize', handler)
  }
}
