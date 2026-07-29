// Bundle the browser code in `src/assets/js/` into `src/assets/dist/`.
//
// A separate step rather than a runtime `Bun.build` call, because `bun build --compile`
// produces a single binary with no source tree beside it: the server has to import the
// finished bundle as TEXT so the compiler can embed it. Running the bundler on the first
// request would work in development and fail in production, which is the worst order to
// discover it in.

import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// `fileURLToPath`, not `URL.pathname`: on Windows the latter yields "/C:/dev/..." and
// every filesystem call against it fails with EFAULT.
const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT = `${ROOT}src/assets/dist`

await rm(OUT, { recursive: true, force: true })
await mkdir(OUT, { recursive: true })

const result = await Bun.build({
  entrypoints: [
    `${ROOT}src/assets/js/core.ts`,
    `${ROOT}src/assets/js/post.ts`,
    `${ROOT}src/assets/js/login.ts`,
  ],
  outdir: OUT,
  target: 'browser',
  // IIFE, not ESM, and this is load-bearing. The bundles are injected as plain
  // `<script src defer>` (see src/web/assets.ts), which is a CLASSIC script: every
  // top-level declaration lands on the global scope. Three self-contained ESM bundles have
  // no import or export left to make that a syntax error, so they loaded happily and then
  // stamped on each other — post.js declares `h` (its scroll-watch helper) and so does
  // core.js (`drawIcon`), the minifier gave both the same letter, post.js loaded second and
  // won, and clicking Dark called the button as if it were a function. Dark mode did
  // nothing until the reader reloaded. An IIFE has no top-level scope to collide in.
  format: 'iife',
  minify: true,
  // The oldest engines that still get updates. Anything older does not run the frozen
  // tree either, so this narrows nothing that was previously supported.
  //
  // A syntax error in one bundle must not silently ship an empty file, so failures below
  // are fatal.
  naming: '[name].js',
})

if (!result.success) {
  for (const log of result.logs) console.error(log)
  process.exit(1)
}

/**
 * A budget, in bytes, per bundle. Set just above what each currently costs, so adding a
 * feature is a deliberate act: either it fits, or the number moves in a diff someone reads.
 * A JavaScript budget nobody defends is not a budget, and the frozen tree's 143 KB of
 * framework is what that looks like after two years.
 */
const BUDGET: Record<string, number> = {
  // Every public page: the beacon, the header's overlays and controls, the grid toggle.
  // Raised from 6,500 when the theme control and the sidebar drawer were ported — two
  // header buttons that had no JavaScript behind them at all, so the site could neither
  // switch to dark nor open its own sidebar on a phone. Paid for in part by deleting the
  // fetch-based infinite scroll, which a timeline feed has no next page for.
  // Raised again to 8,000 for the newsletter overlay. The header's mail button pointed at
  // an anchor that only exists at the foot of an ARTICLE, so on every listing it scrolled
  // nowhere; the frozen tree opens a modal with its own copy of the form, and now so does
  // this. The same change fixed the in-page card, which was never enhanced at all because
  // the handler looked for the status line inside the form instead of beside it.
  // Raised to 8,800 for the chunked feed and the scroll-reveal fallback. The feed rendered
  // all 68 posts at once with no easing at all: the .reveal class had been in the markup
  // since M2 and no rule ever matched it, and there was nothing to hand the archive back a
  // page at a time. Both are what the frozen tree does.
  // Raised to 9,400 (measured: 9,254) for the navigation bar. The public site is real page
  // loads, so a tap on a link left the page it was on looking untouched until the next one
  // arrived; the owner asked for the same signal the admin got. 565 bytes, and it intercepts
  // nothing — it sets one attribute the stylesheet draws from, and the delay before it does
  // is what keeps a prerendered navigation from flashing a bar for one frame.
  'core.js': 9_400,
  // /{slug}: back to top, code copy, lightbox, subscribe, comments, the ToC highlight and
  // book mode. Raised from 8,000 when book mode grew its real chrome — a title bar, a page
  // count and side arrows over a clipped viewport, and a spread measured to exactly two
  // facing pages — which is the reader the frozen tree shipped rather than the four
  // edge-to-edge columns that stood in for it. Raised again for the Turnstile widget: the
  // server has refused unverified comments since M3, and without the widget the reader had
  // no way to produce a token, so on a site with Turnstile on the form simply did not work.
  // Raised to 10,000 for the book-mode fix: a spread INDEX and a measured step, in place
  // of a relative scrollBy that drifted a column gap per page turn, plus the crossfade the
  // frozen tree had between spreads. Raised to 11,000 for comment sign-in: an identity
  // strip, the second fetch that fills it, and a sign-out. That cost is paid by every
  // reader of every post, including the ones who will never sign in, which is why it is
  // written down here rather than absorbed.
  'post.js': 11_000,
  // /login only, and NOT loaded with core.js: the sign-in page carries no beacon, no
  // search overlay and no listing controls, so it pays for the reveal toggle, the caps-lock
  // warning and the one-time-code paste, and nothing else.
  'login.js': 1_500,
}

let over = false
for (const output of result.outputs) {
  const name = output.path.split(/[\\/]/).pop() ?? ''
  const size = (await output.text()).length
  const budget = BUDGET[name]
  console.log(`${output.path.slice(ROOT.length)}  ${size} b${budget ? ` / ${budget} b` : ''}`)
  if (budget && size > budget) {
    console.error(`  over budget by ${size - budget} b. Make it smaller, or move the number.`)
    over = true
  }
}
if (over) process.exit(1)
