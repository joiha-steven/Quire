# Open questions

Not yet decided. Answering one usually means writing an ADR, not editing this file.

## Are the 61 API routes as mechanical as the import count suggests?

The three-week estimate in `v2/docs/00-plan.md` assumes `next/server` to Hono is mostly a
signature change. If they turn out entangled with `next/cache` and ISR, week 3 becomes
weeks 3 to 5. **Probe first:** port the two most cache-entangled routes before committing
to the estimate.

## Do `sharp` and `satori` embed in a compiled Bun executable?

Native and wasm parts may have to ship beside the binary. The Go plan carried the same
asterisk through cgo and libvips, so this does not change the decision, but it changes what
"one executable" means in the deploy runbook.

## What replaces the Google Drive backup archive for instance-to-instance moves?

litestream covers continuous replication. `v2/docs/00-plan.md` promises a manual
export/import archive still exists, but its format is unspecified.

## Does book mode survive the vanilla rewrite intact?

It is the single most intricate island (column-flow pagination, clone of the rendered body,
resize and font-load recomputation) and the one with no equivalent anywhere else to copy
from.
