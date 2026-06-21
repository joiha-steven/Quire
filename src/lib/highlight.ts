// Server-side syntax highlighting with Shiki. Runs at render (ISR-cached), so the
// public bundle ships ZERO highlighting JS. Dual-theme output (Vitesse light/dark,
// muted by design to fit the minimal reading surface): every token carries both a
// light color and a `--shiki-dark` CSS var, and `globals.css` swaps to the dark var
// under `.dark`. A failed highlight returns null so the caller keeps the plain block.
import { createHighlighter, type Highlighter } from 'shiki'

// Curated language set — common on a writing/tech blog. Unknown languages fall
// back to plain text (still themed, no token colors). Keep this list small: each
// language adds to the WASM grammar load.
const LANGS = [
  'js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'bash', 'shell', 'python',
  'go', 'rust', 'sql', 'yaml', 'markdown', 'diff', 'php', 'java', 'c', 'cpp', 'swift',
] as const

const THEMES = { light: 'vitesse-light', dark: 'vitesse-dark' } as const

// One highlighter instance per server process, created lazily on first use.
let hl: Promise<Highlighter> | null = null
function highlighter(): Promise<Highlighter> {
  hl ??= createHighlighter({ themes: [THEMES.light, THEMES.dark], langs: [...LANGS] })
  return hl
}

const loaded = new Set<string>(LANGS)

// Highlight one code block to HTML (`<pre class="shiki">…`). `lang` comes from the
// Markdown fence (```ts). Returns null on any failure (unknown lang load error,
// highlighter init) so the caller falls back to the original escaped block.
export async function highlightCode(code: string, lang: string): Promise<string | null> {
  try {
    const h = await highlighter()
    const language = loaded.has(lang) ? lang : 'text'
    return h.codeToHtml(code, {
      lang: language,
      themes: THEMES,
      defaultColor: 'light', // light inline as the base; dark via --shiki-dark var
    })
  } catch {
    return null
  }
}
