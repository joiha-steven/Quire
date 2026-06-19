// One-off: fix captions on WordPress-imported posts/pages.
//
// WordPress captions came across as a standalone *italic* paragraph right BELOW
// the image, while the image's own caption slot (its markdown alt) kept the
// filename. vibeblog renders the caption from the alt, so this moves each
// trailing italic paragraph INTO the image alt and deletes the paragraph. The
// italic disappears for free (figcaption is upright).
//
// Usage:
//   node --env-file=../vibeblog-private/.env.local scripts/fix-import-captions.mjs [--dry]

import { list, put } from '@vercel/blob'
import matter from 'gray-matter'

const DRY = process.argv.includes('--dry')
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) { console.error('Missing BLOB_READ_WRITE_TOKEN'); process.exit(1) }

const IMG = /^\s*!\[[^\]]*\]\([^)]*\)\s*$/
// Whole line wrapped in a SINGLE * or _ (real italic). The (?![*_]) / (?<![*_])
// guards reject **bold** / __bold__; the letter-or-digit check (applied below)
// rejects thematic breaks like "* * *". Both are needed so a re-run never eats a
// bold heading or an <hr> that happens to sit right under an image.
const ITALIC = /^\s*[*_](?![*_])[\s\S]+?(?<![*_])[*_]\s*$/
const isItalicCaption = (l) => ITALIC.test(l) && /[\p{L}\p{N}]/u.test(l)
// Also catch partial-italic captions, e.g. "_… LEGO.com_. Nguồn ảnh: lego.com"
// (WordPress styled only the descriptive part). Guarded: starts with a single
// italic mark, is short (a caption, not a body paragraph), and has real text.
const startsItalic = (l) => /^\s*[*_](?![*_])/.test(l)
const isCaptionLine = (l) =>
  isItalicCaption(l) || (startsItalic(l) && l.trim().length < 220 && /[\p{L}]/u.test(l))

// Flatten caption markdown into plain text the alt slot can hold:
// [text](url) -> text, drop stray emphasis/brackets, collapse spaces.
function toCaption(line) {
  const inner = line.trim().replace(/^[*_]/, '').replace(/[*_]$/, '')
  return inner
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> text
    .replace(/[*_`]/g, '')                    // stray emphasis/code marks
    .replace(/[\[\]]/g, '')                   // brackets break ![alt]
    .replace(/"/g, '″')                  // keep alt="" intact
    .replace(/\s+/g, ' ')
    .trim()
}

function fixBody(body) {
  const lines = body.split('\n')
  const out = []
  let moved = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (IMG.test(line)) {
      // look past blank lines for a standalone italic caption paragraph
      let j = i + 1
      while (j < lines.length && lines[j].trim() === '') j++
      const isStandalone = j < lines.length && isCaptionLine(lines[j]) &&
        (j + 1 >= lines.length || lines[j + 1].trim() === '')
      if (isStandalone) {
        const caption = toCaption(lines[j])
        out.push(line.replace(/^(\s*!\[)[^\]]*(\]\([^)]*\)\s*)$/, `$1${caption}$2`))
        i = j // skip the consumed caption line; trailing blank handled by loop
        moved++
        continue
      }
    }
    out.push(line)
  }
  return { body: out.join('\n'), moved }
}

async function readText(url) { return (await fetch(url, { cache: 'no-store' })).text() }

let touched = 0, captions = 0
for (const prefix of ['posts/', 'pages/']) {
  const { blobs } = await list({ prefix, token: TOKEN, limit: 1000 })
  for (const b of blobs.filter((x) => x.pathname.endsWith('.md'))) {
    const raw = await readText(b.url)
    const { data, content } = matter(raw)
    const { body, moved } = fixBody(content)
    if (!moved) continue
    captions += moved
    touched++
    console.log(`  ${b.pathname}  (+${moved})`)
    if (!DRY) {
      await put(b.pathname, matter.stringify(body, data), {
        access: 'public', addRandomSuffix: false, allowOverwrite: true,
        contentType: 'text/markdown', token: TOKEN,
      })
    }
  }
}
console.log(`\n${DRY ? 'DRY: ' : ''}${captions} captions moved across ${touched} files.`)
if (DRY) console.log('Re-run without --dry to apply.')
