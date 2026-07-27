// The islands that belong to a LIST or to a whole article: the listing controls and book
// mode.
//
// Split from `interactive.test.ts` to stay under the 400-line rule.

import { beforeEach, describe, expect, it } from 'bun:test'
import { book } from './book'
import { listing } from './listing'
import { page, stubFetch, useDom } from './test-dom'

useDom()

beforeEach(() => page(''))

describe('listing controls', () => {
  const page1 = `<div class="listing"><article class="card">One</article></div>
    <nav class="pager"><a rel="next" href="/page/2">Older</a></nav>`
  const LABELS = { gridView: 'Grid view', listView: 'List view' }

  const nextPage = (cards: string, next: string | null) =>
    `<html><body><div class="listing">${cards}</div>${
      next ? `<nav class="pager"><a rel="next" href="${next}">Older</a></nav>` : ''
    }</body></html>`

  /** Drive the observer directly rather than faking a scroll. */
  function captureObserver(): { fire: () => void } {
    const box = { fire: () => {} }
    globalThis.IntersectionObserver = class {
      constructor(cb: (entries: { isIntersecting: boolean }[]) => void) {
        box.fire = () => cb([{ isIntersecting: true }])
      }
      observe(): void {}
      disconnect(): void {}
    } as unknown as typeof IntersectionObserver
    return box
  }

  beforeEach(() => {
    try { localStorage.clear() } catch { /* ignore */ }
    delete document.documentElement.dataset.list
  })

  it('remembers grid across page loads', () => {
    page(`<button data-grid-toggle></button>${page1}`, LABELS)
    captureObserver()
    listing()
    expect(document.documentElement.dataset.list).toBe('list')

    document.querySelector<HTMLButtonElement>('[data-grid-toggle]')!.click()
    expect(document.documentElement.dataset.list).toBe('grid')
    expect(document.querySelector('[data-grid-toggle]')!.getAttribute('aria-pressed')).toBe('true')

    // A second page load, same reader.
    page(`<button data-grid-toggle></button>${page1}`, LABELS)
    listing()
    expect(document.documentElement.dataset.list).toBe('grid')
  })

  it('hides the toggle on a page with no list', () => {
    page('<button data-grid-toggle></button><article>a post</article>', LABELS)
    captureObserver()
    listing()
    expect(document.querySelector<HTMLButtonElement>('[data-grid-toggle]')!.hidden).toBe(true)
  })

  it('appends the next page and follows its pager', async () => {
    page(page1, { ...LABELS, infinite: '' })
    const observer = captureObserver()
    stubFetch(() => new Response(nextPage('<article class="card">Two</article>', '/page/3')))
    listing()
    observer.fire()
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelectorAll('.listing .card').length).toBe(2)
  })

  it('removes the pager once there is nothing left to page to', async () => {
    page(page1, { ...LABELS, infinite: '' })
    const observer = captureObserver()
    stubFetch(() => new Response(nextPage('<article class="card">Two</article>', null)))
    listing()
    observer.fire()
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('.pager')).toBeNull()
  })

  it('LEAVES the pager alone when a fetch fails', async () => {
    // The reader still has a working link, which is the whole reason the pager was not
    // replaced by this in the first place.
    page(page1, { ...LABELS, infinite: '' })
    const observer = captureObserver()
    stubFetch(() => new Response('nope', { status: 500 }))
    listing()
    observer.fire()
    await new Promise((r) => setTimeout(r, 0))
    expect(document.querySelector('.pager a[rel="next"]')).not.toBeNull()
  })

  it('does nothing at all when the owner has infinite scroll off', async () => {
    page(page1, LABELS) // no `infinite` attribute
    const observer = captureObserver()
    const urls = stubFetch(() => new Response(nextPage('<article class="card">Two</article>', null)))
    listing()
    observer.fire()
    await new Promise((r) => setTimeout(r, 0))
    expect(urls.length).toBe(0)
    expect(document.querySelectorAll('.listing .card').length).toBe(1)
  })
})

describe('book mode', () => {
  const article = `<button data-book-open>Book mode</button>
    <div class="prose"><h2 id="a">A</h2><p>Body text</p></div>`
  const LABELS = { bookModePrev: 'Previous page', bookModeNext: 'Next page', bookModeClose: 'Close' }

  /** happy-dom lays nothing out, so the stage's scroll geometry is supplied here. */
  const geometry = (stage: HTMLElement, width: number, scrollWidth: number) => {
    Object.defineProperty(stage, 'clientWidth', { value: width, configurable: true })
    Object.defineProperty(stage, 'scrollWidth', { value: scrollWidth, configurable: true })
    let left = 0
    Object.defineProperty(stage, 'scrollLeft', {
      get: () => left, set: (v: number) => { left = v }, configurable: true,
    })
    // `scrollBy` is overloaded (options, or x and y), so the stub is cast rather than
    // written to satisfy both signatures for a test that only ever calls the first.
    stage.scrollBy = (((opts?: ScrollToOptions) => { left += opts?.left ?? 0 }) as unknown) as typeof stage.scrollBy
  }

  const open = () => {
    book()
    document.querySelector<HTMLButtonElement>('[data-book-open]')!.click()
    return document.querySelector<HTMLDialogElement>('.book-overlay')!
  }

  it('opens a modal dialog over a CLONE, leaving the article alone', () => {
    page(article, LABELS)
    const overlay = open()
    expect(overlay.tagName).toBe('DIALOG')
    expect(overlay.open).toBe(true)
    expect(overlay.querySelector('.book-flow')!.innerHTML).toContain('Body text')
    // The original is still in the document. The page a search engine and a screen reader
    // see is untouched by anything that happens in the reader.
    expect(document.querySelector('.prose p')!.textContent).toBe('Body text')
  })

  it('turns pages with the arrow keys and counts them', () => {
    page(article, LABELS)
    const overlay = open()
    const stage = overlay.querySelector<HTMLElement>('.book-stage')!
    geometry(stage, 1000, 4000)

    dispatchEvent(new Event('resize'))
    expect(overlay.querySelector('.book-page')!.textContent).toBe('1 / 4')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(overlay.querySelector('.book-page')!.textContent).toBe('2 / 4')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    expect(overlay.querySelector('.book-page')!.textContent).toBe('1 / 4')
  })

  it('tears down on close and stops listening for keys', () => {
    page(article, LABELS)
    const overlay = open()
    overlay.close()
    expect(document.querySelector('.book-overlay')).toBeNull()
    // A stale handler would throw against a dialog that is no longer in the document.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(document.querySelector('.book-overlay')).toBeNull()
  })

  it('does nothing when the owner has book mode off, so there is no toggle', () => {
    page('<div class="prose"><p>Body</p></div>', LABELS)
    expect(() => book()).not.toThrow()
    expect(document.querySelector('.book-overlay')).toBeNull()
  })
})
