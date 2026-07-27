// Shared DOM helpers. Bundled into every entry point that uses one, never served alone.
// `whenActivated` lives in `activation.ts` rather than here, because the bundler shakes
// per module and keeping it here shipped it to pages that never call it.

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
