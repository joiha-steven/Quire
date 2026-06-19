// Enforce 100% Markdown in stored content: convert raw HTML left in posts/pages
// into Markdown (the importer's turndown missed these). Currently the only raw
// HTML in content is <table> blocks; those become GFM tables. Any other raw HTML
// is reported so it can be handled (the renderer escapes unknown HTML anyway).
//
// Usage:
//   node --env-file=../vibeblog-private/.env.local scripts/convert-html-to-markdown.mjs [--dry]

import { list, put } from '@vercel/blob'
import matter from 'gray-matter'
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'

const DRY = process.argv.includes('--dry')
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) { console.error('Missing BLOB_READ_WRITE_TOKEN'); process.exit(1) }

const td = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-' })
td.use(gfm)

// Turndown a single cell's inner HTML to inline Markdown; keep it pipe-safe.
function cellMd(html) {
  return td.turndown(html).replace(/\n+/g, ' ').replace(/\|/g, '\\|').trim()
}

// Header label by column content: a column of 4-digit years -> "Năm", else "Bộ".
function header(rows, col) {
  return rows.every((r) => /^\d{4}$/.test(r[col]?.replace(/\\/g, '').trim() || '')) ? 'Năm' : 'Bộ'
}

function tableToMarkdown(tableHtml) {
  const rows = [...tableHtml.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) =>
    [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) => cellMd(c[1])),
  )
  if (!rows.length) return tableHtml
  const cols = Math.max(...rows.map((r) => r.length))
  const head = Array.from({ length: cols }, (_, c) => header(rows, c))
  const line = (cells) => `| ${Array.from({ length: cols }, (_, c) => cells[c] ?? '').join(' | ')} |`
  return [line(head), `|${' --- |'.repeat(cols)}`, ...rows.map(line)].join('\n')
}

let touched = 0
const leftover = {}
for (const prefix of ['posts/', 'pages/']) {
  const { blobs } = await list({ prefix, token: TOKEN, limit: 1000 })
  for (const b of blobs.filter((x) => x.pathname.endsWith('.md'))) {
    const { data, content } = matter(await (await fetch(b.url + '?cb=' + Date.now(), { cache: 'no-store' })).text())
    let body = content.replace(/<table[\s\S]*?<\/table>/gi, (t) => `\n\n${tableToMarkdown(t)}\n\n`)
    // Report any other raw HTML still present outside code fences.
    const probe = body.replace(/```[\s\S]*?```/g, '').replace(/`[^`]*`/g, '')
    for (const m of probe.matchAll(/<\/?([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g)) {
      leftover[m[1].toLowerCase()] = (leftover[m[1].toLowerCase()] || 0) + 1
    }
    if (body !== content) {
      touched++
      console.log(`  ${b.pathname} (table -> markdown)`)
      if (!DRY) {
        await put(b.pathname, matter.stringify(body, data), {
          access: 'public', addRandomSuffix: false, allowOverwrite: true,
          contentType: 'text/markdown', token: TOKEN,
        })
      }
    }
  }
}
console.log(`\n${DRY ? 'DRY: ' : ''}${touched} files converted.`)
const left = Object.keys(leftover)
console.log(left.length ? `Remaining raw HTML tags: ${left.map((t) => `${t}(${leftover[t]})`).join(', ')}` : 'No raw HTML left. Content is 100% Markdown.')
if (DRY) console.log('Re-run without --dry to apply.')
