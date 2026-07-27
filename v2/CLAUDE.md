# Quire 2.0: operating notes

This directory is Quire 2.0: **Bun + Hono + SQLite**. The rules in the repository root
`CLAUDE.md` describe the **frozen** Next.js implementation in `src/` and do not apply
here.

Plan and specs live in `docs/`:
[00-plan](docs/00-plan.md) ·
[01-schema](docs/01-schema.md) ·
[02-structure](docs/02-structure.md) ·
[03-golden](docs/03-golden.md) ·
[04-frontend](docs/04-frontend.md) ·
[05-importer](docs/05-importer.md) ·
[06-auth](docs/06-auth.md)

Read `00-plan.md` before anything else. Read the specific spec before touching its area.

`../go/` is **superseded**. Do not build from it. See `../go/SUPERSEDED.md`.

## Working principles

Carried over from the Next implementation, because they worked.

1. **Think before coding.** State assumptions. If two readings are possible, present both
   rather than picking silently. If a simpler approach exists, say so.
2. **Simplicity first.** The minimum code that solves the problem. No speculative
   abstractions, no interfaces with one implementation, no error handling for impossible
   states.
3. **Surgical changes.** Touch only what the task requires. Do not "improve" adjacent
   code. Exception, mandatory: when behaviour changes, update the matching doc in the
   same change.
4. **Definition of Done.** `bun run check:all` exits 0 (typecheck, lint, the guard
   scripts, `bun test`). A change touching `src/render` or `src/web` also runs the golden
   compare.
5. **Run what you changed and look at it.** Start the binary, open the page, drive it with
   headless Chromium. Reading source is not verification. Never test against production.

## The porting rule

This project is a **port, not a rewrite**. That distinction is the entire reason the
stack was chosen (00-plan.md, "Why Bun and not Go").

- When moving a file from `../src`, **move it**. Do not improve it, rename its exports,
  or modernise its idioms on the way. A diff that is pure motion is reviewable; a diff
  that is motion plus cleanup is not.
- Its tests move with it, in the same commit.
- If the file is genuinely wrong, port it as-is first, then fix it in a separate commit
  that says what changed and why.

Every "small improvement" made in transit is a place a behaviour can vanish without
anyone noticing, and silent feature loss is the top risk in the register.

## Hard rules

- **400 lines per file maximum.** Enforced in CI.
- **No `any`.** Use `unknown` and narrow. `any` is acceptable only at a JSON boundary
  that immediately validates into a typed shape.
- **No SQL string building.** Every query is a literal with bound parameters. The single
  exception is the analytics facet column, which comes from a fixed lookup table
  (01-schema.md §3).
- **Every handler**: time and log the request, catch and log errors, return a typed error
  response.
- **Every write route is mounted on the owner-gated router group.** Not checked inside the
  handler. See Invariant 4.
- **Secrets never reach a client-bound payload**: `users.password_hash`,
  `users.totp_secret`, `recovery_codes`, `integration_keys`, `mcp_tokens`.
- **Comments explain why, not what.** The Next codebase was unusually good at this. Keep
  the standard.
- **Code, comments, identifiers, filenames, commits, docs: English.** Vietnamese only in
  `src/i18n` locale data and user-facing UI strings.
- **UI strings live in `src/i18n` only.** All 6 languages stay in sync (en default, then
  vi, de, ja, zh, ko).

## Invariants

Full statement in [02-structure.md](docs/02-structure.md). Short form:

1. Cache is cleared **completely** after every write. `clearCache()`, unconditional.
2. Posts and pages share one `/{slug}` namespace. `ensureSlugFree` on create and rename.
3. Image refs are stored store-relative. `collapseBlob` on write, `expandBlob` on read.
4. Write routes are owner-gated by router-group membership, not a per-handler check.
5. Raw HTML in markdown is escaped, never executed.
6. Every delete is a soft delete. Live reads share one `liveOnly` fragment.
7. Analytics writes go through the flush buffer, never straight from a handler.

Each has a test. A change that weakens one updates the test in the same commit, which
makes it visible.

## Database

Two SQLite files, `quire.db` and `analytics.db`, joined with `ATTACH` where needed.
`bun:sqlite` is synchronous and the runtime is single-threaded, so there is exactly one
writer by construction: no pool, no mutex, no busy-retry. The cost is that a slow query
blocks everything, so keep the request path indexed.

Timestamps are **INTEGER milliseconds since epoch, UTC**, everywhere. Timezone logic
lives in TypeScript, never in SQL.

Schema and the full Postgres mapping: [01-schema.md](docs/01-schema.md).

## The frozen Next tree

`../src` is read-only reference material. Read it freely when porting a behaviour. Never
edit it. It accepts security patches only, applied by a human decision, and its version
stays at 1.5.0.
