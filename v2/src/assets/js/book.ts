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

    const stage = el('div', { class: 'book-stage' }, flow)
    const page = el('span', { class: 'book-page' })

    const turn = (delta: number) => {
      stage.scrollBy({ left: delta * stage.clientWidth, behavior: 'instant' as ScrollBehavior })
      update()
    }
    const update = () => {
      const per = stage.clientWidth || 1
      const total = Math.max(1, Math.round(stage.scrollWidth / per))
      page.textContent = `${Math.round(stage.scrollLeft / per) + 1} / ${total}`
    }

    const nav = (cls: string, glyph: string, delta: number, name: string) => {
      const b = el('button', { type: 'button', class: cls, 'aria-label': label(name) }, glyph)
      b.addEventListener('click', () => turn(delta))
      return b
    }
    const close = el('button', { type: 'button', class: 'book-close', 'aria-label': label('bookModeClose') }, '✕')

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); turn(1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); turn(-1) }
    }

    const next = document.createElement('dialog')
    next.className = 'book-overlay'
    next.append(
      el('div', { class: 'book-bar' },
        nav('book-prev', '‹', -1, 'bookModePrev'), page, nav('book-next', '›', 1, 'bookModeNext'), close),
      stage,
    )
    close.addEventListener('click', () => next.close())
    next.addEventListener('close', () => {
      document.removeEventListener('keydown', onKey)
      removeEventListener('resize', update)
      next.remove()
      dialog = null
    })
    // The column count changes with the window, and so does the page count.
    addEventListener('resize', update)
    stage.addEventListener('scroll', update, { passive: true })

    document.body.appendChild(next)
    dialog = next
    next.showModal()
    document.addEventListener('keydown', onKey)
    update()
  }

  toggle.addEventListener('click', open)
}
