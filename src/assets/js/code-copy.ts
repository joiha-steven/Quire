// A "copy" button on every code block. The highlighted HTML is server-rendered (Shiki),
// so the button is attached afterwards rather than baked into the markup.
//
// Guarded per `<pre>`: running twice attaches nothing twice.

import { el, label } from './dom'

export function codeCopy(): void {
  const copy = label('copyCode')
  const copied = label('copiedCode')
  for (const pre of document.querySelectorAll<HTMLPreElement>('.prose pre')) {
    if (pre.querySelector('.code-copy')) continue
    const btn = el('button', { type: 'button', class: 'code-copy', 'aria-label': copy })
    btn.textContent = copy
    btn.addEventListener('click', () => {
      const code = pre.querySelector('code')?.innerText ?? pre.innerText
      navigator.clipboard?.writeText(code).then(
        () => {
          btn.textContent = copied
          setTimeout(() => { btn.textContent = copy }, 1500)
        },
        () => {},
      )
    })
    pre.appendChild(btn)
  }
}
