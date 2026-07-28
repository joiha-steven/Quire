# SUPERSEDED: do not build from this directory

The Go rewrite was planned on 2026-07-26 and superseded on 2026-07-27 by
[`../v2/`](../../docs/spec/00-plan.md) (Bun + Hono + SQLite).

No Go code was ever written. Only specs exist here.

## Why it was dropped

Full reasoning in `../v2/docs/00-plan.md`, "Why Bun and not Go". In short:

1. **Porting beats reimplementing.** 42 of 65 `src/lib` files never touch the database
   (~6,500 lines), and 35 test files (2,427 lines) move unchanged in TypeScript. In Go
   all of it would have been translated, and translation is where behaviour goes missing.
2. **Three weeks instead of eight or nine.** The Go plan's own risk register rated
   "project stalls before M1" as High.
3. **The quality regressions vanish.** Keeping `marked`, `shiki`, `sharp` and `satori`
   removes the goldmark parity risk, the Chroma downgrade, the OG-image rebuild, and the
   permanent second markdown engine in the newsletter and editor paths.
4. **61 of 66 admin components are already `'use client'`.** The admin is a React SPA
   wrapped in Next, so it can be extracted rather than ported. That deletes the largest
   and riskiest milestone in the Go plan (the Tiptap vanilla port, with its Vietnamese
   IME, autosave and conflict-detection risk).

The durability argument for Go was real but narrower than it looked: what rots on a
ten-year horizon is the tooling layer, and the `templ` + `sqlc` pairing added two
third-party code generators that the Bun plan does not have.

## What was salvaged

| File | Fate |
|---|---|
| `docs/01-schema.md` | **moved** to `v2/docs/`, edits confined to the connection strategy and the SQL-function section |
| `docs/05-importer.md` | **moved** to `v2/docs/`, edits confined to the invocation and one verification line |
| `docs/03-golden.md` | **rewritten**. Same corpus and capture design, but the parser no longer changes, so it became a byte-equality gate instead of a diff review |
| `docs/04-frontend.md` | **rewritten**. The 23-island table and the font analysis survive; budgets tightened to 0 KB, Tailwind dropped, admin kept as React |
| `docs/00-plan.md` | replaced |
| `docs/02-packages.md` | replaced by `v2/docs/02-structure.md` |
| `CLAUDE.md` | replaced by `v2/CLAUDE.md` |

Kept rather than deleted because the schema mapping and importer verification design were
the most expensive thinking in it, and because the reasoning above is worth being able to
re-read rather than re-derive.
