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

## M2: every public route (2026-07-27)

| File | Role |
|---|---|
| `src/web/article.ts` | The `/{slug}` page, split out of the router so the router stays a routing table |
| `src/web/listing.ts` | ONE renderer for home, pagination, category, tag, series and search |
| `src/web/feeds.ts` | RSS, sitemap, robots, llms.txt |

Routes live: `/`, `/page/:n`, `/category/:slug(/page/:n)`, `/tag/:slug(/page/:n)`,
`/series/:slug`, `/search`, `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`,
`/{slug}`. Measured on the running server, and **every HTML route contains zero
`<script`**.

**A bug the test found, and it was an SEO one.** `paginate` CLAMPS an out-of-range page, so
checking "did this page come back empty?" never fired: `/page/9` of a two-page blog served
page two, under a ninth URL, and so would every number a crawler tried. Duplicate content
at unbounded URLs. The check compares against `totalPages` now.

Three deliberate decisions:

- **Search is not cached.** Its key would be the query string, which is unbounded, so a
  cache any anonymous visitor can fill is a memory leak with a nicer name. FTS5 makes the
  read cheap enough not to need one.
- **A disabled feed 404s** rather than serving an empty document. An empty feed looks like
  a broken site to an aggregator; a 404 looks like what it is.
- **Pagination is prev/next, not numbered.** Deep page numbers are navigation nobody uses
  and every one is a URL a crawler walks. A simplification, recorded rather than silent.

A series page is not paginated: it is read front to back.

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


## M2: the first islands, hand-written (2026-07-27)

| File | Role |
|---|---|
| `src/assets/js/core.ts` | `whenActivated`, `label`, `el`, `onScrollFrame`. Bundled in, never served alone |
| `src/assets/js/{back-to-top,code-copy,lightbox}.ts` | Three islands, one file each |
| `src/assets/js/post.ts` | The `/{slug}` bundle: imports the three and calls them |
| `scripts/build-assets.ts` | Bundles `js/` into `dist/`, ahead of time |
| `src/web/assets.ts` | Imports the bundle as TEXT, hashes it, serves it |

**2,966 bytes, minified, for the whole article page.** One request, `defer`, cached
`immutable` for a year under a content-hashed URL. The listing, taxonomy, series, search
and feed routes still contain zero `<script`.

**Why the bundle is built ahead of time.** `bun build --compile` produces one binary with
no source tree beside it, so a runtime `Bun.build` would work in development and fail in
production. The server imports the finished bundle with `with { type: 'text' }`, which the
compiler embeds.

**Two of the four were deleted rather than ported**, which is what 04-frontend.md called
for and I nearly missed:

- **`ReadingProgress` is now CSS.** `animation-timeline: scroll(root block)` on a
  server-rendered bar. No script, no scroll listener, no main-thread work, and it works
  with JavaScript switched off. An `@supports` guard removes the element entirely on an
  engine without scroll timelines, so the failure mode is absence rather than a hairline
  stuck at zero. `features.progressBar` still decides whether the markup exists at all.
- **`Lightbox` is a `<dialog>`.** Escape, focus trapping, the inert background and the
  backdrop are the browser's job now, not this file's. What is left is the picture and the
  arrows. Navigating swaps the image inside the dialog rather than rebuilding it, because
  rebuilding drops focus and re-runs `showModal` on every arrow press.

I wrote both as JavaScript first, as a straight port of the React components, and caught it
only on re-reading the spec. Worth recording: the porting rule says move it, do not improve
it, but the spec had already decided these two were to be **deleted**. Applying the porting
rule past the plan is not discipline.

**The rest became one bundle, deliberately.** The frozen tree mounted each behind a
server-side condition (`content.includes('```')`, `imageUrls.length > 0`). Here each part
guards itself on the markup it needs, so a post with no code and no images downloads the
same file and runs two queries that find nothing. A transport change, not a behaviour
change: the frozen tree split them because React's per-island cost was real, and this whole
bundle is smaller than one of those islands was.

**No locale table crosses the wire.** Every string an island shows is translated on the
server and handed over as a `data-` attribute on `<body>`. The bundle has no language of
its own and cannot disagree with the page it is running on.

**The DOM boundary is now type-checked, not remembered.** `src/assets/js/` has its own
tsconfig with `lib: ["DOM"]`, and the root project excludes it and has no DOM lib. A server
module that reaches for `document` fails to compile. `check:all` runs both projects.

**The islands have tests, which is new.** Browser code is the one part `bun test` cannot
reach by making a request, so until now the only evidence any of it ran was that the
bundler accepted the syntax. 14 tests drive them against happy-dom: the copy button is
idempotent and reverts its label, the lightbox wraps at both ends, tears down on `close`
however it was closed, and reopens cleanly. happy-dom is registered for that ONE file and
unregistered in `afterAll` — registering globally would hand the router tests happy-dom's
`fetch` and `Response` instead of Bun's.

Measured on the running server: article page one script, body carrying six `data-` labels,
unknown asset hash 404s, home page zero scripts.

*Caveat worth stating: happy-dom is not Chromium. These tests prove the logic, not that
`showModal` and scroll-driven animations behave identically in a real engine.*

**Two Windows traps, both fatal, both silent about the real cause.**
`new URL('..', import.meta.url).pathname` yields `/C:/dev/...`, and every filesystem call
against it fails with `EFAULT: bad address`. `fileURLToPath` is the fix. And for the second
time, **a backtick inside a comment in `public.css.ts` ended the template literal** and the
server refused to boot. The file now carries a note saying so.

Still to come in M2: the analytics beacon (`core.js` + `POST /api/track`), OG images,
search/subscribe/comments overlays, book mode, and the listing islands.

## M2: the analytics beacon (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/track.ts` | `app/api/track/route.ts` | `POST /api/track`, always 204 |
| `src/assets/js/track.ts` | `Track.tsx` + `ScrollDepth.tsx` | The beacon, both halves in one file |
| `src/assets/js/activation.ts` | `lib/prerender.ts` | `whenActivated`, alone in its own module |
| `src/assets/js/core.ts` | new | The bundle every public page loads |

**core.js is 1,162 b; post.js is 2,966 b.** A listing pays for the first only; an article
pays for both. Both numbers are now enforced: `build-assets.ts` fails the build over
budget, so adding a feature either fits or moves a number in a diff someone reads. A
JavaScript budget nobody defends is not a budget, and the frozen tree's 143 KB of framework
is what that looks like after two years.

**Every public page carries the beacon**, which is why `core.js` exists at all. A pageview
that only fired on posts would undercount the home page, every listing and every taxonomy
page, which between them are most of a blog's traffic. Listings had zero `<script` before
this commit and now have one; the router test was changed to say so rather than deleted.

**`whenActivated` got its own module because the bundler shakes per module, not per
export.** Sitting beside the DOM helpers it rode into `post.js`, where nothing calls it —
182 bytes for a prerender guard on a page that has no beacon. Splitting it also took
`core.js` from 1,602 b to 1,162 b, since the beacon does not need `el` or `onScrollFrame`.
Found by grepping the built bundle for `prerendering`, not by reading the source.

**`Track` and `ScrollDepth` merged into one file.** They were two React components because
they mounted at different points in the tree; as plain functions they share a path, a
beacon helper and an activation guard, and splitting them would duplicate all three.

**One behaviour is deliberately NOT ported yet, and is written down rather than left to be
noticed.** The frozen handler opens with `if (await requireOwner()) return 204`, so an
owner reading their own blog is never counted. 2.0 has no session to ask until M3. Recorded
in `docs/07-parity.md` §8 and in a comment at the top of `track.ts`.

**A test assertion that was wrong about its own subject.** The flood test counted the
buffer and expected 240; it got 40, because the buffer flushes itself at `MAX_ROWS` (that
is Invariant 7 working). It counts the table now.

Driven against the running server, not just `app.request`: one view with
`referrer_host=news.ycombinator.com`, `device=desktop`, `browser=Chrome`, `os=Windows`; one
scroll row at `depth=83`, `dwell_ms=45000`; a Googlebot beacon dropped; and the visitor
column holding a hash with neither the IP nor the user-agent anywhere in the row.

## M2: OG cards, and the route that serves every image (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/render/og-card.ts` | `app/og/route.tsx` | The 1200x630 card, satori + sharp |
| `src/render/fonts/*.woff` | `app/og/*.woff` | Three Inter subsets, embedded in the binary |
| `src/web/og.ts` | same route's handler half | `GET /og`: query parsing, the SSRF guard, caching |
| `src/web/uploads.ts` | `app/uploads/[...path]/route.ts` | `GET /uploads/*`: streamed, range-capable |

**`next/og` was satori plus a WASM rasteriser; this is satori plus sharp**, which was
already a dependency and already rasterises SVG. One new package (`satori`) rather than
two. The element tree is built as plain objects instead of JSX, so this file does not need
a different JSX pragma from the rest of the codebase.

**A background image has to be INLINED as a data URI.** satori emits `<image href="...">`
and hands the SVG to sharp, which does not fetch remote references. Passing the URL
through produces a card with the gradient and no picture: a valid PNG, a silent failure,
and the sort of thing that is discovered on Twitter.

**The bug that only a screenshot could find.** satori ignores `inset: 0`, so the dark
overlay collapsed to zero height and the first working card was white text on bright orange
at 55% opacity: unreadable. It returned 200, it was a valid 1200x630 PNG, and every
structural assertion passed. Both layers now carry explicit `top`/`left`/`width`/`height`,
and a test compares the brightness of the top and bottom strips so the wash cannot vanish
again.

**Two ways to measure a picture wrongly, both of which return a confident number.**
`sharp(...).extract(...).stats()` computes on the INPUT image and ignores the pipeline, so
every strip of the card reported the same value. And the fourth channel is alpha, a flat
255, which drags every average toward white. Both are written down in the test helper.

A third: "the card is not blank" first compared two strips of ONE card, which measures the
diagonal base gradient rather than the type. It compares the same strip across a titled and
an untitled card now.

**`GET /uploads/*` was missing entirely**, which meant every image in a rendered post, every
featured image and every OG background resolved to a 404. Found while wiring the card's
background, not by a test. Ported near-verbatim, including single byte-range support: video
seeking needs 206 responses and iOS Safari will not play a video at all without them.

**A security test that passed without testing anything.** `/uploads/../../package.json` is
normalised by the URL parser before the router sees it, so the handler never ran. The
traversal cases are percent-encoded now, so they arrive intact and `resolveSafe` is what
has to reject them.

**`blob-local` resolves its root once, at module load.** Setting `STORAGE_LOCAL_DIR` from a
test is too late, because the import is hoisted. The upload test asks the driver where the
store is via `resolveSafe` and creates one directory inside it.

Open Graph and Twitter tags now exist at all: the shell had none. `summary_large_image`
only when there is an image, because with that card type and no image X stretches the site
favicon across it.

Also corrected: a `site ? ... : undefined` guard around the card URL was dead code, since
`resolveSiteUrl` falls back to `SITE_URL` and then to localhost. The comment claiming
otherwise was worse than no comment. The test that asserted the dead branch now asserts
what actually happens.

## M2: the machine surfaces, and the files nobody was serving (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/markdown.ts` | `api/md/[slug]/route.ts` | The post as its authored Markdown |
| `src/web/manifest.ts` | `app/manifest.ts` | The PWA manifest, from live settings |
| `src/web/preview.ts` | `(blog)/preview/[slug]/page.tsx` | Tokened draft preview |
| `src/web/search-api.ts` | `api/search/route.ts` | `GET /api/search`, metadata only |
| `src/web/static.ts` | `public/` | Fonts, favicon, app icon, embedded in the binary |
| `src/web/api.ts` | `lib/api.ts` (partly) | `json` / `fail`, and the request logger |

**Content negotiation moved out of `next.config.ts` and into the router.** The frozen tree
rewrote `/:slug` to `/api/md/:slug` when the request carried `Accept: text/markdown`, in a
config file three directories away from the route it affected. It is now four lines in the
`/:slug` handler, next to the thing it changes. Both URLs still work.

**Request logging is middleware, not a call in every handler.** The frozen tree ended each
handler with `logRequest(req, status, start)`, including inside every early return, so the
rule was kept by remembering it and the failure mode was a route that silently logged
nothing. Now a request is logged because it went through the router. Same reasoning as
Invariant 4 gating writes by router-group membership rather than by a per-handler check.

**`public/` was never served, and that was worse than it sounds.** Every page emits
`<link rel="preload" href="/fonts/inter-latin.woff2">` and nothing answered it: the site's
reading font never loaded, so the entire typography system was decorative. Same for
`/app-icon.png` and `/favicon.ico`. Found by requesting the URLs after the manifest landed,
not by any test. 21 fonts, the favicon and the app icon are now imported with
`with { type: 'file' }` and listed BY NAME, because there is no glob import the compiler
can follow and a font missing from that list works in development and 404s in production.
Next's scaffolding SVGs were deliberately left behind.

**The sharp risk escalated from "images fail" to "the server will not start", and is now
back to "one route fails".** `bun build --compile` bundles sharp's JavaScript but not its
native module. That was recorded in M1 as a first-image-call failure. Adding the OG card
put sharp on the boot path, and the compiled binary died at startup — a blog that serves
nothing because it cannot draw a social card. Two static imports were the cause, and the
second was not obvious: `content/settings.ts` imports `renderLogo` from `media/files.ts`,
and settings is on every request. Both are now `await import('sharp')` at the point of use.

Measured on the COMPILED binary, run from a directory containing nothing but the exe:

```
/                                  200  12,224 b
/fonts/inter-latin.woff2           200  36,116 b
/fonts/literata-vietnamese.woff2   200   8,652 b
/app-icon.png  /favicon.ico        200
/manifest.webmanifest              200     418 b
/robots.txt                        200
/og?title=Test                     500   (logged; the packaging decision is M4's)
```

That is the failure shape worth having: the blog works, one route does not, and the log
says why.

**Ported as-is, and wrong:** the preview banner is a hardcoded Vietnamese string in the
frozen tree, which breaks 2.0's rule that UI strings live in `src/i18n` in all six
languages. Moved verbatim here per the porting rule; fixed in the next commit.

## M2: the two things a reader can write to (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/comments.ts` | `api/comments/route.ts` | Read the tree, post a comment |
| `src/web/newsletter.ts` | `api/subscribe` + `api/newsletter/{confirm,unsubscribe,open}` | The whole sign-up path |
| `src/assets/js/comments.ts` | `Comments` + `CommentForm` + `CommentsLazy` | One island instead of three |
| `src/assets/js/subscribe.ts` | `SubscribeForm` | Enhancement, not the only path |

**core.js 1,162 b; post.js 6,700 b** against a budget raised from 4,000 to 8,000. The
budget moving is the point: it moved in a diff.

**PARITY EXCEPTION: Google sign-in is gone, so the trusted-commenter path is gone.** The
frozen tree had two identities. A commenter signed in with Google was trusted — name and
email came from the session and Turnstile was skipped — and everyone else filled in a form.
ADR 0007 removes Google sign-in, so only the manual path survives. A reader who never
signed in loses nothing; one who did now fills in two fields. Recorded in
`docs/07-parity.md`.

**Comments stay client-fetched, and that is not laziness.** The article page is cached HTML
(Invariant 1) and a comment is not a post. Rendering the thread into the page would force a
choice between flushing the entire page cache whenever a stranger types something and
serving a stale thread. Fetching sidesteps both, which is why the frozen tree did it too.
The fetch is held behind an `IntersectionObserver`: a reader who never reaches the bottom
of the article never makes the request.

**DELIBERATE DEVIATION, stated because it is one.** The frozen tree built its sign-up form
in JavaScript, so a reader without it saw no form and lost nothing. 2.0 renders the form
server-side — to keep it out of the JavaScript budget and out of the layout shift — which
means a reader without JavaScript now *can* submit it. Answering that submit with a page of
JSON would be a defect this port created rather than one it carried. So `/api/subscribe`
takes a form post as well as JSON and replies in kind, with the same status code either
way: **400 stays 400**, because the status describes the request, not the presentation.

**PLACEMENT DEVIATION:** the frozen tree put a subscribe TRIGGER in the site header, opening
an overlay. The overlay is still to be ported, and a trigger with nothing behind it is worse
than no trigger, so the form sits at the end of the article for now.

**The XSS boundary is one line either way.** A comment's `contentHtml` goes through
`innerHTML`, which is safe for exactly one reason: the server rendered it through the
limited-markdown sanitiser in `comment-md.ts`. The author NAME goes through `textContent`.
Reversing those two turns a comment section into an XSS on every reader of the post, so
there is a test that puts `<img src=x onerror=…>` in a name and asserts no element appears.

**Three near-misses of my own, all caught by the type checker or a test:**

- I added 15 locale keys that mostly already existed (`commentsHeading`, `commentEmailNote`
  and the rest of the family were there). Duplicate keys in one object literal are a
  compile error, which is the only reason this was not a second, drifting set of strings.
- The two that *were* new got named `subThanks`/`subPending`, ignoring the `nl*` family
  beside them. Renamed `nlInvalid` / `nlNoMail`; `nlPending` was rejected because the admin
  strings already use that name for a subscriber status.
- The test seeded subscribers with `db().run(sql, a, b)`, which types its rest parameter as
  an array OF binding arrays. Same trap `store/query.ts` documents.

Still to come in M2: the search / subscribe / comments OVERLAYS and the header that triggers
them, book mode, the left rail and its table of contents, and the listing islands (grid
toggle, infinite scroll).

## M2: the site chrome, and search without a page load (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/chrome.ts` | `(blog)/layout.tsx` | The header and footer, shared by both renderers |
| `src/assets/js/search.ts` | `SearchTrigger` + `SearchOverlay` + `SearchClient` | One island instead of three |
| `src/assets/js/test-dom.ts` | new | The happy-dom harness the island tests share |

**core.js 3,849 b / 5,000; post.js 5,999 b / 8,000.** `subscribe` moved from `post` to
`core`, because the sign-up form now lives in the footer of every page rather than at the
end of an article.

**The header and footer were duplicated and had already drifted.** `article.ts` and the
listing renderer each built their own `<header class="site">`, and only one of them rendered
the tagline. One function each now, called from both. That is the duplication the listing
renderer was extracted to avoid, reappearing one level up.

**Every control in the chrome works without JavaScript.** The search trigger is
`<a href="/search">`, which renders the same results server-side; the island calls
`preventDefault` and opens a `<dialog>` instead. The subscribe trigger is `<a href="#subscribe">`
pointing at the footer form. Neither is a `<button>` with a script behind it, which is what
makes "enhancement" true rather than a word.

**Two bugs the search island would have had, both written as tests:**

- **Out-of-order responses.** A slow answer for `ti` can land after a fast one for
  `timezone` and replace the right results with stale ones. Every request carries a sequence
  number and only the newest may write. The test delays the first response by 300 ms.
- **One request per keystroke.** Debounced to one per 200 ms pause. The test types five
  characters in a burst and asserts exactly one request.

**`lightboxClose` is reused for the overlay's close button** rather than adding a `close`
key. It already says exactly this in six languages, and a second key with the same meaning
is how a locale table starts to drift — which this port has now nearly done twice.

**The island test file hit 469 lines** and the file-size guard caught it. Split by concern:
`islands.test.ts` keeps the article islands, `interactive.test.ts` takes sign-up, comments
and search, and the happy-dom harness moved to `test-dom.ts` so it is registered per file in
one place rather than copied.

Measured on the running server: the home page has one script, an article has two, the
header carries `data-search-open`, and the subscribe trigger is correctly ABSENT because no
mail server is configured — a trigger with nothing behind it is worse than no trigger.

Still to come in M2: the left rail and its table of contents, book mode, and the listing
islands (grid toggle, infinite scroll).

## M2: the listing controls, and one more island deleted (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/assets/js/listing.ts` | `GridToggle` + `InfiniteListing` | Both, self-guarding |
| — | `RevealFallback` | **Deleted.** `animation-timeline: view()` in the sheet |

**core.js 5,186 b against a budget raised from 5,000 to 6,500.** The guard caught it at
5,186 and refused to build, which is the first time the budget has actually stopped
something. The number moved in this diff, deliberately.

**`RevealFallback` is gone, as 04-frontend.md called for.** It existed to ease cards in on
engines without scroll-driven animations. Those animations are what the reading-progress bar
already uses, so the fallback was the last consumer of a shim for a feature this codebase
now depends on. Cards ease in with `animation-timeline: view()`, wrapped in `@supports` and
in `prefers-reduced-motion: no-preference`. An engine without it shows the cards, which is
the correct end state anyway.

**Infinite scroll adds no endpoint.** It fetches the next page's HTML and moves its cards
across. That page has to exist and be crawlable regardless, so this reuses it rather than
adding a second representation of the same list that could drift from the first. On a failed
fetch the island disconnects and leaves the pager alone — the reader still has a working
link, which is the reason the pager was never replaced.

**A cost I am taking rather than hiding.** The frozen tree applied the saved grid/list
choice with a PRE-PAINT INLINE SCRIPT, so a reader who chose grid never saw the list. 2.0
has no inline script anywhere and that property is tested, so the attribute is applied when
`core.js` runs and a grid reader may see one frame of list first. The two alternatives were
worse: an inline script would be the only one on the site, and a cookie would let the server
render it but the page cache is keyed by URL alone (Invariant 1), so a cached page would
carry whichever mode the first visitor happened to have.

**A test bug that made a test pass for the wrong reason.** `delete document.body.dataset[key]`
did not always clear the underlying attribute in happy-dom, so a `data-infinite` set by one
test survived into the next. The harness removes the ATTRIBUTES now. Found because the
"does nothing when infinite scroll is off" case fetched anyway — the one assertion in the
file that could only fail if state leaked.

Measured on the running server: the grid toggle is in the header, the grid and reveal rules
are in the inlined sheet, `data-infinite` is correctly absent (the owner has it off), and
the home page still costs one script.
