// The shipped bundles, not the sources they were built from.
//
// Every other test in `src/assets/js` imports the TypeScript directly, which is why this
// shipped: the bundles are injected as plain `<script src defer>` (a CLASSIC script, see
// `src/web/assets.ts`), so anything declared at their top level lands on the shared global
// object. Built as ESM they had no import or export left to make that a syntax error, so
// `post.js` and `core.js` each declared a top-level helper the minifier named `h`, post.js
// loaded second and overwrote core.js's, and switching to dark mode called a DOM element as
// if it were a function. Nothing that imports the sources can see that.
//
// The fix is `format: 'iife'` in `scripts/build-assets.ts`. This holds it.

import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const DIST = join(import.meta.dir, 'dist')
const BUNDLES = ['core.js', 'post.js', 'login.js']
const read = (name: string) => readFileSync(join(DIST, name), 'utf8')

describe('the public bundles', () => {
  for (const name of BUNDLES) {
    it(`${name} is wrapped, so it declares nothing on the global scope`, () => {
      // `(()=>{ … })()` or `(function(){ … })()`. Either way the first token opens a
      // function expression, which is what having no top-level scope looks like.
      expect(read(name)).toMatch(/^\(\s*(\(\s*\)\s*=>|function\s*\(\s*\))\s*\{/)
    })

    it(`${name} carries no module syntax, which a classic script cannot parse`, () => {
      const src = read(name)
      expect(src).not.toMatch(/(^|[;}\s])export\s*[{*]/)
      expect(src).not.toMatch(/(^|[;}\s])import\s*[{*'"]/)
    })
  }

  it('two bundles may share a minified name without colliding', () => {
    // The specific failure: both files define a function the minifier called `h`. That is
    // fine now and must stay fine, so this asserts the overlap still EXISTS rather than
    // pretending the names were made unique.
    const names = (src: string) =>
      new Set([...src.matchAll(/function ([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1] as string))
    const core = names(read('core.js'))
    const shared = [...names(read('post.js'))].filter((n) => core.has(n))
    expect(shared.length).toBeGreaterThan(0)
  })
})
