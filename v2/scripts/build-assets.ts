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
  entrypoints: [`${ROOT}src/assets/js/post.ts`],
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

for (const output of result.outputs) {
  const size = (await output.text()).length
  console.log(`${output.path.slice(ROOT.length)}  ${size} b`)
}
