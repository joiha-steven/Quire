// Capture the FROZEN implementation's output for every corpus fixture.
//
//   cd <repo root> && bun golden/capture-corpus.ts
//
// Run from `v1/`, not from the repository root: it imports the frozen renderer by relative
// path, and that component's own `@/lib/...` specifiers resolve through v1's tsconfig, not
// this one. Nothing in `../v1/src` is written to or modified.
//
// The captured HTML in `golden/v1/corpus/` is the CONTRACT. Regenerating it is a reviewed
// change, because it silently moves the goalposts: if 2.0 starts producing different
// markup, the fix is 2.0, not this file.
//
// Fixtures are hand-written, so no personal content enters the repository. They also
// outlive the port: `marked` is a live dependency for the next ten years, and this becomes
// its regression suite.

import { readdirSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
// eslint-disable-next-line -- deliberate cross-tree read of the frozen implementation
import { PostContent } from '../v1/src/components/blog/PostContent'

const CORPUS = join(import.meta.dir, 'corpus')
const OUT = join(import.meta.dir, 'v1', 'corpus')

type Element = { props: { dangerouslySetInnerHTML?: { __html: string } } }

async function render(markdown: string): Promise<string> {
  const el = (await PostContent({ markdown })) as unknown as Element
  return el.props.dangerouslySetInnerHTML?.__html ?? ''
}

mkdirSync(OUT, { recursive: true })
const names = readdirSync(CORPUS).filter((f) => f.endsWith('.md')).sort()
for (const name of names) {
  const markdown = readFileSync(join(CORPUS, name), 'utf8')
  const html = await render(markdown)
  writeFileSync(join(OUT, name.replace(/\.md$/, '.html')), html, 'utf8')
}
console.log(`captured ${names.length} fixtures from the frozen implementation`)
