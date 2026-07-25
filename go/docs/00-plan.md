# Quire 2.0 (Go) — master plan

Status: DRAFT for review. No code written yet.

## Goal

Replace the Next.js implementation of Quire with a Go one that ships as a single
binary plus a single SQLite file, at full feature parity, then retire the Next
codebase.

The reason is NOT raw speed. It is:

1. **Payload.** The public post page currently ships 738 KB raw / 196 KB brotli of
   JavaScript across 13 files to render 6 KB (brotli) of article HTML. About 100 KB
   brotli of that is the structural floor of Next.js (react-dom 61 KB + client router
   34 KB) and cannot be removed while staying on Next. Target: under 15 KB brotli.
2. **Operations.** Today a Quire instance needs Node, Next, PostgreSQL, PostgREST,
   generated JWT keys, DB roles and grants, and a migration runner. Target: download
   one binary, run it.
3. **Dependency surface.** The current tree pins `next` hard and carries unpatched
   critical advisories that cannot be resolved without breaking the pin. Go plus a
   handful of well-maintained libraries removes that treadmill.

## Non-goals

- Not a rewrite of the product. Features, URLs, content model and admin concepts stay
  the same. Users should not have to learn anything.
- Not horizontally scalable. One process, one machine, one SQLite file. This is a
  deliberate ceiling, revisited only if a real instance outgrows it.
- Not a new name. The product stays **Quire**. `quire-go` is a temporary directory
  and disappears at M4.

## Stack decisions

| Area | Choice | Why |
|---|---|---|
| Language | Go 1.24+ | Large training corpus (matters: this codebase is AI-written), fast builds, one binary |
| DB | SQLite, `mattn/go-sqlite3` | cgo is already required for libvips, so the cgo driver costs nothing extra and has the fewest FTS5 surprises. `modernc.org/sqlite` is the fallback if libvips is ever dropped |
| Queries | `sqlc` | Plain SQL in, type-safe Go out. No ORM, no reflection |
| Templates | `templ` | Compile-time checked, no runtime template parsing, no reflection |
| Markdown | `goldmark` | CommonMark + GFM, extensible, the parser Hugo uses |
| Highlighting | `alecthomas/chroma` | Pure Go, no Node |
| Images | `libvips` via cgo | Keeps AVIF + WebP output identical in quality to `sharp` |
| Editor | Tiptap core (vanilla, no React) | `@tiptap/core` is framework agnostic; only the `@tiptap/react` wrapper is dropped |
| JS bundling | `esbuild` Go API | Invoked from `go generate`. npm is needed once to fetch Tiptap, never at deploy |
| Backup | `litestream` to Cloudflare R2 | Replaces ~730 lines of Google Drive OAuth + cron with continuous point-in-time replication |
| Mail | `wneessen/go-mail` | SMTP with sane defaults |

## Repository layout during development

The Next tree is **not moved**. `manhhung.me` keeps deploying exactly as it does
today (`rsync src/`, bump `.deployment-id`, build, restart) for the whole project.

```
quire/
  src/ scripts/ docs/ deploy/ ...   Next.js, FROZEN, deploy unchanged
  go/
    go.mod
    cmd/quire/                      the server binary
    cmd/import-v1/                  one-way importer from Quire v1
    internal/                       see 02-packages.md
    assets/                         JS + CSS sources, embedded via go:embed
    golden/                         parity harness + reference snapshots
    docs/                           this directory
    CLAUDE.md                       Go working rules (replaces the TS rules here)
```

At M4, in a single commit: `git mv` the Next tree into `legacy/` (or delete it, git
keeps the history), promote `go/*` to the root, switch the deploy script.

## Freeze policy

From today, `src/` accepts **security patches only**. No new features, no refactors.
Version stays at 1.4.37.

This is not bureaucracy. Every rewrite that also has to chase a moving target dies.
If a feature is important enough to add during the next two months, it is important
enough to add to Quire 2.0 instead.

`go/` starts at `2.0.0-dev`.

## Milestones

Every milestone must produce something deployed and reachable over the internet. A
milestone that only runs on localhost does not count as done.

### M0 — Foundations (week 1)

- SQLite schema, reviewed against `scripts/schema.sql` line by line (see 01-schema.md)
- `cmd/import-v1` importing production data into SQLite, with verification (05-importer.md)
- Golden harness capturing reference HTML from Quire v1 (03-golden.md)
- Go module skeleton, `sqlc` config, CI running `go vet` + `golangci-lint` + `go test`
- `go/CLAUDE.md` written

**Gate:** importer runs against a copy of production, every table's row count matches,
and the golden harness has captured every public URL.

### M1 — Public renderer (week 3)

Everything a reader sees: posts, pages, the shared `/{slug}` namespace, category and
tag pages with pagination, series pages, search, preview links, RSS, sitemap, robots,
llms.txt, OG images, ToC, footnotes, video embeds, `<picture>` responsive images,
book reading mode, 6 theme palettes, 6 locales, redirects, scheduled publishing.

**Gate:**
- Deployed to a real subdomain, serving imported production content
- Golden diff clean, or every difference recorded in `golden/accepted.yaml` with a reason
- Post page ships under 15 KB brotli of JS and under 12 KB brotli of CSS
- Lighthouse on a real post at least matches the current site

### M2 — Admin and editor (week 5)

Server-rendered admin from Go, Tiptap ported to vanilla, media pipeline on libvips,
revisions, trash, taxonomy management, settings, themes, fonts, redirects manager.

**Gate:** a post is written, illustrated, saved, revised, restored from a revision,
and published entirely through the new admin, verified by driving headless Chromium.

### M3 — Everything else (week 7)

Comments (tree, Turnstile, reply notification), newsletter (double opt-in, broadcast,
open pixel, SMTP config), analytics v2 (engagement, channels, audience, drill-down),
MCP server (tokens, OAuth DCR, replay guard), backup and restore, WordPress import,
activity log, health probe, cron jobs.

**Gate:** newsletter round trip through Mailpit, backup taken and restored into an
empty instance, MCP connected from a real client and a post written through it.

### M4 — Cutover (week 8 to 9)

Final import, DNS switch, one week of observation, then the repository reshuffle and
the Next tree retired.

**Gate:** seven days on the new stack with no rollback.

## Risk register

| Risk | Severity | Mitigation |
|---|---|---|
| `marked` and `goldmark` render existing posts differently | **High** | Golden harness is a gate, not a check. Every accepted difference needs a written reason |
| Shiki and Chroma produce different code-block markup | Medium | Port the theme to a Chroma style, compare by screenshot |
| MCP tokens break at cutover and AI publishing silently stops | Medium | Preserve the token hash format; verify a live MCP write before DNS switch |
| Analytics timezone bucketing regresses | Medium | The tz logic moves from plpgsql to Go. Port the existing test cases first |
| libvips version differences change AVIF output | Low | Pin the libvips version in the deploy image; images are regenerated, not compared |
| Project stalls before M1 | **High** | M1 must be publicly reachable by week 3. If it is not, stop and re-scope |

## Explicit parity exceptions

Deviations from Quire 1.x that are intentional. Each needs to stay short and justified.

1. **Google Drive backup is replaced by litestream to R2.** Continuous point-in-time
   replication instead of scheduled archives. Removes OAuth, refresh-token storage, the
   cron job and ~730 lines. A manual export/import archive is still provided for
   migration between instances.
2. **Search becomes accent-insensitive at the index level.** Postgres uses
   `to_tsvector('simple', ...)`, which is accent sensitive, with an accent-insensitive
   layer bolted on in the `/search` route. FTS5 with `remove_diacritics 2` does this
   natively and better. Ranking changes from "none" to BM25.
3. **Cache invalidation becomes total instead of targeted.** See 02-packages.md. This
   makes Invariant 1 structurally unbreakable rather than test-enforced.
4. **Sessions do not survive cutover.** Everyone signs in again once. MCP tokens do
   survive.

## Open questions

- Do any third parties currently self-host Quire 1.x? If yes, they need a documented
  migration path and a deprecation window, and that changes the M4 gate.
- Is the SaaS multi-tenant model "one SQLite file per tenant"? It is the natural fit
  and worth designing for now even if it is not built yet.
