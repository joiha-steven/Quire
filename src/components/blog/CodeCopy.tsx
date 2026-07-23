'use client'

// Adds a "copy" button to every code block in the rendered article. The code HTML is
// server-rendered (Shiki, injected via dangerouslySetInnerHTML), so the button is
// attached on mount rather than baked into the markup. Idempotent — re-running on a
// client navigation won't double up (guarded per <pre>).
import { useEffect } from 'react'

export function CodeCopy({ label, copiedLabel }: { label: string; copiedLabel: string }) {
  useEffect(() => {
    const pres = document.querySelectorAll<HTMLPreElement>('.prose pre')
    pres.forEach((pre) => {
      if (pre.querySelector('.code-copy')) return
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'code-copy'
      btn.textContent = label
      btn.setAttribute('aria-label', label)
      btn.addEventListener('click', () => {
        const code = pre.querySelector('code')?.innerText ?? pre.innerText
        navigator.clipboard?.writeText(code).then(
          () => {
            btn.textContent = copiedLabel
            setTimeout(() => (btn.textContent = label), 1500)
          },
          () => {},
        )
      })
      pre.appendChild(btn)
    })
  }, [label, copiedLabel])
  return null
}
