# Port ledger

Every file moved from the frozen tree, and every one deliberately left behind. Kept so a
module cannot be dropped silently: `v2/docs/07-parity.md` covers behaviour, this covers
files.

## Moved, unchanged (M1, 2026-07-27)

33 modules and 17 tests. Their bodies were not touched. The only edits were import
specifiers, counted below.

| Destination | Modules |
|---|---|
| `render/` | footnotes · toc · video · inline-md · og · rail-css |
| `content/` | taxonomy · series-order · paginate · preview · settings-sanitize · themes |
| `comments/` | comment-tree · comment-md · comment-env |
| `news/` | newsletter-email · newsletter-html · email-brand |
| `analytics/` | ua |
| `media/` | blob · blob-local · media-usage · mime · http-range |
| `server/` | rate-limit · cdn · safe-fetch · redirect-path |
| `i18n/` | i18n · admin-i18n |
| `auth/` | auth-shared · turnstile |
| root | utils · types.ts · locales/ |

**Edit cost: 46 import specifiers across 43 files. No test body, and no module body,
changed.** 28 `@/lib/<name>` rewrites (2.0 has modules, not a `lib/` directory) and 18
`from 'vitest'` repointed to the local shim (`src/test/vitest.ts`, which maps vitest's call
shapes onto `bun:test`).

Result: **184 tests pass under `bun test`**, from a suite written for vitest and moved
without touching a single assertion. That is the evidence ADR 0005 was betting on.

One self-inflicted detour worth recording: the first `tsconfig.json` turned on
`noUncheckedIndexedAccess`, which the frozen tree does not have. It produced ~20 errors in
code that compiles cleanly at source, i.e. it converted a pure-motion diff into a
motion-plus-rewrite diff. Reverted to match the source exactly; tightening is a separate
pass after the port, tracked in `state/TASKS.md`.

## Rewritten, not moved (M1 data layer, 2026-07-27)

The first six `db()` modules. Signatures and semantics are unchanged; only the query
bodies are. `revalidateTag(DB_TAG, 'max')` becomes `clearCache()`.

| Destination | From | Query changes |
|---|---|---|
| `store/query.ts` | new | `one` / `all` / `run` / `tx` over `bun:sqlite`. Not a query builder |
| `server/cache.ts` | `revalidate.ts` | Collapsed to `clearCache()` (Invariant 1). Read/write side lands in M2 |
| `store/integration-keys.ts` | `integration-keys.ts` | Partial upsert becomes read-merge-write, because the alternative is assembling a SET clause |
| `content/slugs.ts` | `slugs.ts` | Two `maybeSingle` reads become two `select` |
| `server/redirects.ts` | `redirects.ts` | `permanent` is a 0/1 column mapped to a boolean at the edge |
| `content/revisions.ts` | `revisions.ts` | `data` is JSON text. The trim is one DELETE instead of select-then-delete-by-id |
| `content/pages.ts` | `pages.ts` | `upsert` becomes `on conflict(slug) do update`, with `created_at` and `deleted_at` left out of the update list on purpose |

Two changes here are not pure motion, and both exist because storage changed:

1. **`order by saved_at desc, id desc`** in revisions. Postgres `now()` had microsecond
   resolution; `saved_at` is milliseconds. Without the tiebreak, two snapshots saved in the
   same millisecond order arbitrarily, including inside the trim, which would then delete
   the wrong one.
2. **Read-merge-write in `saveIntegrationKeys`.** PostgREST updated exactly the columns in
   the payload. Reproducing that in SQLite means building the SET clause from the payload,
   and no SQL is assembled in this codebase. Same concurrency profile as before: one owner,
   one form, no other writer.

**The mocked query builder is gone.** `slugs.test.ts` and `soft-delete.test.ts` in the
frozen tree mocked PostgREST, and the second one hand-wrote a filter engine, i.e. a second
unverified copy of the database's behaviour. SQLite is in-process, so the data-layer tests
run against the real schema (`src/test/db.ts`). A read path that forgets `liveOnly` now
fails because SQLite really does return the trashed row. 39 tests, and they found two real
behaviours worth naming: an overwrite must pass `previousSlug` or it collides with itself,
and saving a trashed row must not untrash it.

## Rewritten, not moved (M1 content core, 2026-07-27)

The rest of the content modules. `sharp` is added as 2.0's first runtime dependency; it is
what `renderLogo` and every image variant need, and Bun has no built-in image resize.

| Destination | From | Query changes |
|---|---|---|
| `media/image.ts` | `image.ts` | **none.** Pure sharp, moved verbatim with its 6 tests |
| `media/files.ts` | `files.ts` | `.in()` becomes `in (select value from json_each(?))` |
| `media/media.ts` + `media/finalize.ts` | `media.ts` | Split at 406 lines to hold the 400-line rule; `finalize.ts` is the deferred variant/thumb work, the only part with no request on the other end |
| `content/settings.ts` | `settings.ts` | `data` is JSON text. A malformed blob now throws into the existing catch, which already returned defaults |
| `comments/comments.ts` | `comments.ts` | `insert ... returning`, `count(*)` + `limit/offset` for the admin page. `buildCommentTree` untouched |
| `content/posts.ts` + `content/post-terms.ts` | `posts.ts` | The biggest change: `categories`/`tags` move from two `text[]` columns to the `post_terms` junction |

Three things here are not pure motion:

1. **`updateTerm` is no longer a read-modify-write.** The frozen tree read every post's
   array, edited it in JS and wrote it back, and documented that as an accepted
   last-write-wins risk. It is now `update or ignore` + `delete` against one table, and the
   collision-merge falls out of the primary key instead of an array de-dupe.
2. **Search input is escaped into quoted FTS5 phrases.** PostgREST's `websearch` parsed
   user text; a raw `match ?` throws a syntax error on `C++`, a stray quote or a bare `OR`,
   which would have turned a search into a silent empty result. Space-joined phrases keep
   the implicit AND. Ordering stays date-desc: BM25 relevance is an *allowed* parity
   exception that has deliberately NOT been taken during the port, so a ranking change
   cannot be mistaken for a port bug.
3. **Term order within a post is not preserved.** `post_terms` has no ordering column, so
   terms come back alphabetically where the frozen tree kept the author's array order.
   Cosmetic, and adding an ordering column is a schema decision rather than a port.

`json_each` carries every key list. The alternative, generating `in (?, ?, ?)`, is SQL
string building, which this codebase does not do.

**Measured, not assumed:** `bun build --compile` bundles sharp's JavaScript but not its
native module, so the compiled binary throws on first image call from any directory. The
risk register predicted this; it is now confirmed, and the plan records what it costs.

## Rewritten, not moved (M1 newsletter and the small modules, 2026-07-27)

`nodemailer` joins `sharp` as the second runtime dependency.

| Destination | From | Query changes |
|---|---|---|
| `server/activity.ts` | `activity.ts` | `at` is milliseconds; `.neq('id',0)` becomes a plain `delete` |
| `content/series.ts` | `series.ts` | Update counts come from `changes` instead of a `RETURNING` array length |
| `server/scheduled.ts` | `scheduled.ts` | Window query on integer dates; `purgeAndWarm` collapses (see below) |
| `media/media-refs.ts` | `media-refs.ts` | `variants` is a 0/1 column |
| `news/newsletter-log.ts` | `newsletter-log.ts` | `ok` is 0/1; folds unchanged |
| `news/subscribers.ts` | `subscribers.ts` | `upsert` becomes `on conflict(email) do update`, `created_at` deliberately not in the update list |
| `news/mail.ts` | `mail.ts` | Read-merge-write, same reason as `integration-keys` |
| `news/broadcast.ts` | `broadcast.ts` | `.in()` becomes `json_each` |
| `comments/comment-notify.ts` | `comment-notify.ts` | Two `maybeSingle` reads become two `select` |

**`purgeAndWarm` loses its second half.** The frozen tree re-warmed the origin after a
purge because Next's ISR cache was on disk and a cold render cost a visitor real time.
There is nothing to warm in 2.0: the cache is an in-process Map and a miss is a
sub-millisecond SQLite read plus a render. `sweepScheduled` now clears the cache and purges
Cloudflare, and `newlyLive` stays exactly as it was, with its 6 tests moved verbatim, so
the definition of "went live" is untouched.

### A schema bug the port caught

`integration_keys.smtp_secure` had been translated as `integer not null default 1`. The
Postgres column was nullable, and `mail.ts` reads it as `row?.smtp_secure ?? (port === 465)`
— NULL means "not chosen". With NOT NULL DEFAULT 1, any install that had ever saved an
unrelated key on that shared row (a Turnstile site key is enough) would come back with
`secure = true`, so a port-587 STARTTLS server would stop accepting mail with no setting
having been touched, and nothing in the UI would explain why. The column is nullable again
and `news/mail.test.ts` has the regression case, named after the bug.

## Rewritten, not moved (M1 analytics and the six SQL functions, 2026-07-27)

| Destination | From | Notes |
|---|---|---|
| `analytics/channel.ts` | `analytics_channel(host)` | The three regexes copied verbatim, `~*` becoming a case-insensitive test. Pure, so the one judgement call in the SQL is now directly testable |
| `analytics/buckets.ts` | `date_trunc(bucket, created_at at time zone tz)` | Boundaries computed in TypeScript, see below |
| `analytics/buffer.ts` | new | Invariant 7: the flush buffer, 2 s or 200 rows |
| `analytics/record.ts` | `analytics.ts` (write half) | Buffered instead of inline; the pre-migration retry is gone, there is one schema |
| `analytics/aggregate.ts` | shared subqueries | Each helper holds two complete literals rather than one with an optional predicate |
| `analytics/summary.ts` | `analytics_summary` | One plpgsql function becomes a dozen indexed statements |
| `analytics/page.ts` | `analytics_page` | The same helpers with a path filter, so the two can no longer disagree about what "unique visitors" means |
| `analytics/summary.ts` (`getViewTotals`) | `analytics_totals` | One GROUP BY |

**`analytics_facet` did not need its exception.** 01-schema.md reserved "the one place
allowed to assemble SQL from a variable" for the facet column name. Three complete literals
selected from a fixed map do the same job, so the exception is unused and the no-assembled-SQL
rule now holds everywhere without one.

**Channels are folded in TypeScript over distinct (host, visitor) pairs.** SQLite has no
regex and `bun:sqlite` has no user-defined functions. The tempting shape, per-host visitor
counts summed by channel, DOUBLE-COUNTS anyone who arrived from two hosts in the same
channel; the plpgsql version avoided that by grouping on the function's result, and the
fold here does too. Pinned by a test.

**A real bug in the timezone code, caught by its own test.** The first `Intl.DateTimeFormat`
used `hour12: false`, under which a local midnight renders as hour "24" of the PREVIOUS day.
That is exactly the instant day and week buckets start on, so the computed zone offset was a
full day out and the fall-back day came back 23 hours long instead of 25. Fixed with
`hourCycle: 'h23'`; 16 tests cover both DST transitions, Monday week starts, and the
`to_char` label formats.

**Empty buckets are still dropped**, matching `group by date_trunc(...)`. Emitting explicit
zeros would be a better chart and the boundaries are right there to do it, but it changes
what the admin receives, so it belongs next to the component that renders it.

## Rewritten, not moved (M1 MCP store, 2026-07-27)

| Destination | From | Query changes |
|---|---|---|
| `mcp/tokens.ts` | `mcp/tokens.ts` | `insert ... returning`; the SHA-256 hex hash format is UNCHANGED, which is what keeps every connector the owner already holds working across cutover |
| `mcp/clients.ts` | `mcp/clients.ts` | `redirect_uris` was a `text[]`, now a JSON array; an unparseable list fails CLOSED |
| `mcp/used-codes.ts` | `mcp/used-codes.ts` | PostgREST returned a unique violation as an error object, `bun:sqlite` throws it. Same decision, and the catch stays broad because letting a code through on a transient error is the one outcome that matters |
| `mcp/result.ts` | `mcp/result.ts` | **none.** Pure |

Both mocked tests are replaced by real rows. They guard real attacks (open redirect to
owner-account takeover, and authorization-code replay), so a fake that models the primary
key by hand was the wrong thing to trust: 21 tests now, including two fail-closed cases the
mocks could not express.

`mcp/auth.ts`, `mcp/consent.ts`, `mcp/tools.ts`, `mcp/tools-library.ts` and `well-known.ts`
stay for M3: they need the MCP SDK, zod, and the router, and `consent.ts` is built on
`next-auth/jwt`, which ADR 0007 removes.

## Built, not ported (M1 importer, 2026-07-27)

`import-v1` has no v1 counterpart: it exists to move one instance across, once.

| File | Role |
|---|---|
| `src/import/transform.ts` | Column transforms. Pure |
| `src/import/checksum.ts` | Tier 2 canonical checksum, run on BOTH sides by the same code |
| `src/import/verify.ts` | All four tiers, over two row sets. Pure |
| `src/import/write.ts` | One INSERT literal per table, plus `sqlite_sequence` advance and FTS rebuild |
| `scripts/import/source.ts` | The v1 reader over PostgREST. The only place the dev-only `@supabase/postgrest-js` appears |
| `scripts/import-v1.ts` | CLI, transaction boundary, binary verification |

Everything except the PostgREST reader and the CLI is pure, and 51 tests cover it. That
split matters: a verifier wired directly into two live databases can only be tested by
having two live databases, which means in practice it is tested once, by hand, on the day
it is written. Each tier is tested against the corruption it claims to catch, not only
against good data.

Two decisions worth recording:

- **The checksum canonicalises timestamps to epoch milliseconds on both sides.** Postgres
  sends `2026-07-27T10:00:00+00:00` and SQLite holds an integer; without this every dated
  table reports a permanent false mismatch, and a verifier that cries wolf gets ignored on
  the one run that mattered.
- **`ts()` and `bool()` throw rather than defaulting.** An unparseable date silently
  becoming 1970, or an unrecognised flag silently becoming false, is a post that never
  publishes and nobody can explain.

Not yet done: an end-to-end run against a live v1. It needs the dev Postgres stack up, and
production is not a test environment.

`--analytics-out` from the spec is not implemented; `analytics.db` is written beside
`--out`, because `openDatabases` owns both filenames and the server and the importer must
not disagree about where they are. The spec now says so.

## M2 begins: the renderer, and the byte-identical gate held (2026-07-27)

| Destination | From | Change |
|---|---|---|
| `render/highlight.ts` | `highlight.ts` | Same Shiki call, now behind the content-addressed `render_cache` |
| `render/post-content.ts` | `components/blog/PostContent.tsx` | Every transform byte-for-byte the same. The ONLY change is the return: a React server component ending in `dangerouslySetInnerHTML` becomes a function returning the HTML string |
| `render/post-content.test.ts` | `components/blog/post-content.test.ts` | 22 assertions unchanged; only the two-line `render()` helper adapted |

**`marked` and `shiki` are pinned to EXACT versions (18.0.5, 4.2.0), no caret**, matching
what the frozen tree resolves. A byte comparison against a floating dependency fails on a
patch release and teaches everyone to ignore it.

### The golden harness

45 hand-written markdown fixtures in `golden/corpus/`, covering the list in 03-golden.md:
nested lists, lists containing code and tables, lazy continuation, setext headings,
emphasis against Vietnamese diacritics and punctuation, intraword underscores, raw HTML
(Invariant 5), `javascript:`/`data:`/`vbscript:` hrefs including a tab-obfuscated one,
reference links with a missing target, footnotes defined before and after their reference,
duplicates and orphans, GFM alignment and escaped pipes, task lists, three fence cases,
hard breaks, entities, callouts, video URLs, image alignment and grids, a 900-character
line, CRLF, a BOM, and a file with no trailing newline.

**The reference HTML was produced by running the frozen renderer, not written by hand.**
`golden/capture-corpus.ts` imports `../../src/components/blog/PostContent` by relative path
and runs it under Bun; nothing in the frozen tree is written to. Hand-written expectations
would only test that the port was transcribed consistently with itself, which is the thing
least worth testing.

**Result: 46/46 byte-identical**, including the fenced-code fixtures, which means Shiki's
output through the new cache matches Shiki's output without it.

`golden/v1/corpus/` is committed and is the CONTRACT. Regenerating it is a reviewed change:
if 2.0 starts producing different markup, the fix is 2.0.

### A mistake worth recording

`bun add marked shiki hono` was run with the working directory at the repository root, so
it edited the FROZEN tree's `package.json` and bumped `marked` 18.0.5 to 18.0.7 and `shiki`
4.2.0 to 4.3.1. Reverted with `git checkout`. It also produced the useful fact above: the
frozen tree pins older versions than `bun add` would pick, and matching them exactly is a
precondition for the gate.

## M2: the server exists and serves an article (2026-07-27)

| File | Role |
|---|---|
| `src/env.ts` | PORT / DATA_DIR / SITE_URL, validated at boot |
| `src/index.ts` | Boot: open databases, serve, flush analytics on SIGINT/SIGTERM |
| `src/web/app.ts` | The public router. Article route + the page cache |
| `src/web/layout.ts` | The HTML shell. Inline CSS, language-chosen font preloads, no script tag |
| `src/web/public.css.ts` | The hand-written public sheet (ADR 0008) |

Measured on a real server, not reasoned about:

```
cold request   256 ms   (includes Shiki's one-time WASM init)
warm requests  2-4 ms   (page cache hit)
page weight    9,042 bytes, ZERO script tags, ZERO stylesheet requests
```

**A CSS bug the browser found and reading could not.** `applyFootnotes` already emits
`<hr class="fn-rule">`, and the new sheet also put a `border-top` on `.footnotes`, so two
rules were drawn above the notes. Invisible in the markup, obvious in a screenshot. The
frozen tree styles `.fn-rule` and leaves `.footnotes` borderless; the sheet now matches.

**A second one the runtime found.** The comment fixing it used backticks around
`applyFootnotes`, inside a template literal, which terminated the string. The server
refused to boot, which is the right failure. Comments inside `PUBLIC_CSS` use no backticks.

14 router tests run over real HTTP against a real database. Two of them are the ones worth
having: an article page contains no `<script`, and a draft, a future-dated post and a
trashed post all 404 rather than leaking.

Still to come in M2: listings, taxonomy, series, search, feeds, OG images, and the 23
islands as vanilla JS.

## Moved, then pulled back out

| File | Why |
|---|---|
| `prerender.ts` | Copied into `server/` by mistake. It is BROWSER code (the `whenActivated` guard that stops a prerendered page firing analytics beacons, shipped to the frozen tree in M0). In 2.0 the public islands are hand-written vanilla in `assets/js/`, so this becomes part of `core.js` during M2. It does not belong in a server module and its DOM globals do not typecheck there. |

## Not moved yet, and why

| Module | Reason |
|---|---|
| `db` | Replaced by `store/db.ts` (`bun:sqlite`) |
| `auth`, `api` | Replaced: `next-auth` goes (ADR 0007), `next/server` becomes Hono |
| `gdrive`, `backup`, `backup-state` | Google Drive replaced by litestream (parity exception 1) |
| `image`, `highlight`, `wordpress-import`, `well-known` | Need npm dependencies (`sharp`, `shiki`, `turndown`, MCP SDK). Land with their module |
| `upload-client` | Browser-side; belongs to the admin SPA |
| `mcp/auth`, `mcp/consent`, `mcp/tools`, `mcp/tools-library`, `well-known` | Route-shaped, not data-layer: they need the MCP SDK, zod and the router. M3. (`og.ts` turned out to touch no `db()` at all and moved verbatim in the first slice.) |
