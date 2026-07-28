// Book mode: the article re-flowed into a two-column spread, paginated sideways.
//
// The heaviest island in the site, and the only one that is genuinely optional: the base
// page keeps its normal scroll, so nothing here affects reading, SEO or accessibility. It
// exists because a long essay reads better in columns than in one tall ribbon.
//
// A `<dialog>`, so Escape and the inert background come from the browser. The columns come
// from CSS `column-width`, and "turning a page" is one `scrollLeft` assignment: the browser
// has already done the pagination, and re-implementing it in JavaScript is how this kind of
// feature becomes a measurement loop that fights the layout engine.
//
// Book mode is its OWN standard rather than the site theme: paper and ink, not the reader's
// palette. That is deliberate, and carried over from the frozen tree.

import { el, label } from './dom'

const OUTER_MARGIN = 48 // px, the minimum gap from the spread to the viewport edge
const MAX_WIDTH = 1400 // px, so the spread does not sprawl on an ultrawide monitor
const COL_GAP = 56 // px between the two facing pages

export function book(): void {
  const toggle = document.querySelector<HTMLButtonElement>('[data-book-open]')
  const source = document.querySelector<HTMLElement>('.prose')
  if (!toggle || !source) return

  let dialog: HTMLDialogElement | null = null

  function open(): void {
    if (dialog) {
      dialog.showModal()
      return
    }
    const flow = el('div', { class: 'book-flow' })
    // A CLONE. The original stays in the document, so the page a search engine and a screen
    // reader see is untouched by anything that happens in here.
    flow.innerHTML = source!.innerHTML

    // The flow is also `.prose`, so the body keeps the article's own typography inside the
    // reader: the drop cap, the indents and the justification are the same rules.
    flow.classList.add('prose')
    const viewport = el('div', { class: 'book-viewport' }, flow)
    const page = el('span', { class: 'book-count' })

    const turn = (delta: number) => {
      viewport.scrollBy({ left: delta * viewport.clientWidth, behavior: 'instant' as ScrollBehavior })
      update()
    }
    // The spread is exactly TWO columns, sized to the page's own footprint. Leaving the
    // column count to `column-width` alone gave four thin columns running edge to edge,
    // which is a newspaper, not a book: a spread has to be two facing pages with margins.
    const measure = () => {
      // The spread spans the SAME footprint the page occupies, gutters included: the ToC
      // rail sits in the left one and the layout is centred, so the right mirrors it.
      // Falling back to near-full width when no rail is on screen.
      const rail = document.querySelector('.rail')?.getBoundingClientRect()
      const footprint = rail && rail.width > 0 && rail.left >= OUTER_MARGIN
        ? innerWidth - Math.round(rail.left) * 2
        : innerWidth - OUTER_MARGIN * 2
      const width = Math.min(MAX_WIDTH, footprint)
      const column = Math.floor((width - COL_GAP) / 2)
      flow.style.setProperty('--book-col-w', `${column}px`)
      viewport.style.width = `${column * 2 + COL_GAP}px`
      // Cap media to one page, so an image can never push a column past the spread.
      flow.style.setProperty('--book-page-h', `${flow.clientHeight}px`)
      update()
    }
    const update = () => {
      const per = viewport.clientWidth || 1
      const total = Math.max(1, Math.round(viewport.scrollWidth / per))
      page.textContent = `${Math.round(viewport.scrollLeft / per) + 1} / ${total}`
    }

    const nav = (cls: string, glyph: string, delta: number, name: string) => {
      const b = el('button', { type: 'button', class: `book-arrow ${cls}`, 'aria-label': label(name) }, glyph)
      b.addEventListener('click', () => turn(delta))
      return b
    }
    const close = el('button', { type: 'button', class: 'book-x', 'aria-label': label('bookModeClose') }, '✕')
    // The title recedes: regular weight, faint, body size, so the article stays the focus.
    const heading = document.querySelector('article > header h1')?.textContent ?? ''
    const stage = el('div', { class: 'book-stage' },
      nav('book-prev', '‹', -1, 'bookModePrev'), viewport, nav('book-next', '›', 1, 'bookModeNext'))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1) }
    }

    const next = document.createElement('dialog')
    next.className = 'book-overlay'
    next.append(
      el('div', { class: 'book-chrome book-top' },
        el('span', { class: 'book-title' }, heading),
        el('span', { class: 'book-topright' }, page, close)),
      stage,
    )
    close.addEventListener('click', () => next.close())
    next.addEventListener('close', () => {
      document.removeEventListener('keydown', onKey)
      removeEventListener('resize', measure)
      next.remove()
      dialog = null
    })
    // The column count changes with the window, and so does the page count.
    addEventListener('resize', measure)
    viewport.addEventListener('scroll', update, { passive: true })

    document.body.appendChild(next)
    dialog = next
    next.showModal()
    document.addEventListener('keydown', onKey)
    measure()
    // Images sit off-screen in later columns, so lazy-loading would never fire for them and
    // the measurement would count a spread that later grows.
    for (const img of flow.querySelectorAll('img')) img.loading = 'eager'
    document.fonts?.ready.then(measure)
  }

  toggle.addEventListener('click', open)
}
