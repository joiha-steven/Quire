# Open questions

Not yet decided. Answering one usually means writing an ADR, not editing this file.

## How does the binary ship, now that `sharp` is a dependency?

The only one of the rewrite's open questions still open. `bun build --compile` bundles
sharp's JavaScript but not its `@img/sharp-<platform>` native module, so the compiled
binary throws on the first image call. Production currently runs from source. Options and
the measurement are in [`TASKS.md`](TASKS.md).

---

## Answered during the rewrite

Kept as pointers, because "we already looked at that" is worth more than a clean file.

| Question | Answer |
|---|---|
| Are the 61 API routes as mechanical as the import count suggested? | Yes. All of them ported inside M3, in three days, with no cache entanglement worth an ADR. `next/cache` collapsed into one `clearCache()` (Invariant 1) |
| Do `sharp` and `satori` embed in a compiled Bun executable? | `satori` yes, `sharp` no. Still open as a packaging question, above |
| What replaces the Google Drive backup for instance-to-instance moves? | Two things, neither of them litestream: a downloadable `tar.gz` of both databases and the uploads tree (`/api/backup/export`), and an off-box cron script to R2. [`../docs/backups.md`](../docs/backups.md) |
| Does book mode survive the vanilla rewrite intact? | Yes, and it is measurably better: the frozen tree drifted one column-gap per page turn. `src/assets/js/book.ts` |
