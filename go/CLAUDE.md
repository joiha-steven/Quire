# Quire 2.0 (Go) — operating notes

This directory is Quire 2.0. The rules in the repository root `CLAUDE.md` describe the
**frozen** Next.js implementation in `src/` and do not apply here.

Plan and specs live in `docs/`:
[00-plan](docs/00-plan.md) ·
[01-schema](docs/01-schema.md) ·
[02-packages](docs/02-packages.md) ·
[03-golden](docs/03-golden.md) ·
[04-frontend](docs/04-frontend.md) ·
[05-importer](docs/05-importer.md)

Read `00-plan.md` before anything else. Read the specific spec before touching its area.

## Working principles

Carried over from the Next implementation, because they worked.

1. **Think before coding.** State assumptions. If two readings are possible, present
   both rather than picking silently. If a simpler approach exists, say so.
2. **Simplicity first.** The minimum code that solves the problem. No speculative
   abstractions, no interfaces with one implementation, no error handling for
   impossible states.
3. **Surgical changes.** Touch only what the task requires. Do not "improve" adjacent
   code. Exception, mandatory: when behaviour changes, update the matching doc in the
   same change.
4. **Definition of Done.** `go vet ./... && golangci-lint run && go test ./... &&
   go build ./...` all exit 0, plus the size checks. A change that touches
   `internal/render` also runs the golden compare.
5. **Run what you changed and look at it.** Start the binary, open the page, drive it
   with headless Chromium. Reading source is not verification. Never test against
   production.

## Hard rules

- **400 lines per file maximum.** Enforced in CI.
- **No bare `any` / `interface{}`.** Use concrete types or constrained generics.
  `any` is acceptable only at a JSON boundary that immediately unmarshals into a struct.
- **Errors wrap.** `fmt.Errorf("loading post %q: %w", slug, err)`. No bare `return err`
  across a package boundary.
- **Every handler**: log with timing, recover from panics, return a typed error page.
- **Every write route is mounted on the owner-gated router group.** Not checked inside
  the handler. See Invariant 4.
- **No SQL string building.** Every query is a `sqlc`-generated method. The one
  exception is the analytics column whitelist, which uses a fixed lookup table.
- **Comments explain why, not what.** The Next codebase was unusually good at this.
  Keep the standard.
- **Code, comments, identifiers, filenames, commits, docs: English.** Vietnamese only
  in `internal/i18n` locale data and user-facing UI strings.
- **UI strings live in `internal/i18n` only.** All 6 languages stay in sync
  (en default, then vi, de, ja, zh, ko).

## Invariants

Full table in [02-packages.md](docs/02-packages.md). Short form:

1. Cache is flushed **completely** after every write. `cache.Clear()`, unconditional.
2. Posts and pages share one `/{slug}` namespace. `content.EnsureSlugFree` on create
   and rename.
3. Image refs are stored store-relative. `blob.Collapse` on write, `blob.Expand` on read.
4. Write routes are owner-gated by router group membership, not by a per-handler check.
5. Raw HTML in markdown is escaped, never executed. goldmark without `WithUnsafe`,
   plus the href scheme filter.
6. Every delete is a soft delete. Live reads share one `liveOnly` SQL fragment.
7. Analytics writes go through the flush goroutine, never straight to the writer
   connection.

Each has a test in the package that enforces it. A change that weakens one needs the
test updated in the same commit, which makes it visible in review.

## Layout

```
cmd/quire/          the server binary
cmd/import-v1/      one-way importer from Quire 1.x
internal/           see docs/02-packages.md
assets/
  js/               hand-written public bundles, no dependencies
  editor/           Tiptap bundle; editor.js is COMMITTED, see docs/04-frontend.md
  css/              Tailwind sources -> public.css + admin.css
golden/             parity harness; golden/v1 is a committed contract
docs/               specs
```

## Database

Two SQLite files, `quire.db` and `analytics.db`, joined with `ATTACH` where needed.
One writer connection, one read pool, one analytics flush goroutine.
Schema and the full Postgres mapping: [01-schema.md](docs/01-schema.md).

Timestamps are **INTEGER milliseconds since epoch, UTC**, everywhere. Timezone logic
lives in Go, never in SQL.

## The frozen Next tree

`../src` is read-only reference material. Read it freely when porting a behaviour.
Never edit it. It accepts security patches only, applied by a human decision, and its
version stays at 1.4.37.
