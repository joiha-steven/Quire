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
  format: 'esm',
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
  'core.js': 6_500, // every public page: the beacon, the header's overlays, the listing controls
  'post.js': 8_000, // /{slug}: back to top, code copy, lightbox, subscribe, comments
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
