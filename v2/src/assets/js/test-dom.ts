// The happy-dom harness the island tests share.
//
// Registered per FILE and unregistered afterwards, never globally: `GlobalRegistrator`
// replaces `fetch`, `Response` and friends, and the router tests need Bun's.

import { afterAll, beforeAll } from 'bun:test'
import { GlobalRegistrator } from '@happy-dom/global-registrator'

/** Call at the top level of a test file that touches the DOM. */
export function useDom(): void {
  beforeAll(() => GlobalRegistrator.register())
  afterAll(() => GlobalRegistrator.unregister())
}

/** Rebuild the page. Every test starts from a document the server could have sent. */
export function page(body: string, data: Record<string, string> = {}): void {
  document.body.innerHTML = body
  // Attributes, not `delete document.body.dataset[key]`. Deleting through the dataset proxy
  // did not always clear the underlying attribute, so a `data-infinite` set by one test
  // survived into the next and made it pass for the wrong reason. Removing the attribute
  // is the thing that actually happens.
  for (const attr of [...document.body.attributes]) {
    if (attr.name.startsWith('data-')) document.body.removeAttribute(attr.name)
  }
  for (const [k, v] of Object.entries(data)) document.body.dataset[k] = v
}

/**
 * Stand in for the network.
 *
 * `respond` gets the URL and returns the JSON body, or a promise of it when the test needs
 * a slow answer (the out-of-order search case).
 */
export function stubFetch(respond: (url: string, init?: RequestInit) => unknown): string[] {
  const urls: string[] = []
  globalThis.fetch = (((url: string, init?: RequestInit) => {
    urls.push(url)
    return Promise.resolve(respond(url, init)).then((body) =>
      body instanceof Response ? body : new Response(JSON.stringify(body)))
  }) as unknown) as typeof fetch
  return urls
}
