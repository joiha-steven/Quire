# Worklog

Newest first. What happened, not what is true now (that is `docs/`) or what is next (that
is `TASKS.md`). Keep entries short; the detail is in the commit.

## 2026-07-27 — M2: Quire 2.0 serves a page

`env`, `index.ts`, the Hono router, the HTML shell and the hand-written public sheet.
**555 tests, `check:all` green.** The server boots, reads a post out of SQLite and returns
a complete article page.

Measured on the running server rather than reasoned about:

```
cold request   256 ms   (Shiki's one-time WASM init)
warm requests  2-4 ms   (page cache hit)
page weight    9,042 bytes, ZERO script tags, ZERO stylesheet requests
```

**Opening the page in a browser found a bug that reading the markup would not.**
`applyFootnotes` already emits `<hr class="fn-rule">`, and the new sheet also put a
`border-top` on `.footnotes`, drawing two rules above the notes. The frozen tree styles
`.fn-rule` and leaves `.footnotes` borderless; the sheet now matches. Then the comment
explaining the fix used backticks inside a template literal and stopped the server
booting, which is the right way to find out.

14 router tests over real HTTP. The two that matter are not about markup: an article page
contains no `<script`, and a draft, a future-dated post and a trashed post all 404 rather
than leaking.

Still to come in M2: listings, taxonomy, series, search, feeds, OG images, and the 23
islands as vanilla JavaScript.

## 2026-07-27 — M2 started: the renderer, and the byte-identical gate HELD

`highlight` and `PostContent` ported. **541 tests, `check:all` green.** The article-body
gate is met: **46/46 golden fixtures byte-identical to Quire 1.x**, including the ones that
run Shiki.

`PostContent` was already pure string manipulation with a React wrapper at the end, so the
only change is the return value: a server component ending in `dangerouslySetInnerHTML`
becomes a function returning the HTML string. Its 22 tests moved with only the two-line
`render()` helper adapted.

The reference HTML was produced by **running the frozen renderer**, not written by hand:
`golden/capture-corpus.ts` imports the frozen component by relative path and runs it under
Bun, writing nothing to `../src`. Hand-written expectations would only test that the port
was transcribed consistently with itself.

45 fixtures cover the 03-golden.md list, including the ones that are also security
assertions: raw HTML escaped (Invariant 5), and `javascript:`/`data:`/`vbscript:` hrefs
dropped, one of them tab-obfuscated.

**A mistake worth recording:** `bun add` was run with the working directory at the repo
root, so it edited the FROZEN tree's `package.json`, bumping `marked` and `shiki`. Reverted
with `git checkout`. It surfaced something that matters, though: the frozen tree resolves
`marked` 18.0.5 and `shiki` 4.2.0, older than what `bun add` picks, and v2 now pins those
EXACT versions with no caret. A byte comparison against a floating dependency fails on a
patch release and teaches everyone to ignore it.

## 2026-07-27 — M1 complete: the MCP store and `import-v1`

`mcp/tokens`, `mcp/clients` and `mcp/used-codes` moved, then `import-v1` built.
**473 tests, `check:all` green.** M1 is done: every `db()` call site is on `bun:sqlite`,
all six plpgsql functions are reimplemented, and the importer exists with its four tiers.

Both frozen MCP tests mocked the query builder, and they guard real attacks: open redirect
leading to owner-account takeover, and authorization-code replay. A hand-written fake
modelling a PRIMARY KEY was the wrong thing to trust there, so both now run against real
rows, plus two fail-closed cases the mocks could not express. The token hash format is
unchanged, which is what keeps the connectors the owner already holds working.

The importer is deliberately split: transforms, checksum, verification and the writers are
pure and live in `src/import/` with 51 tests; only the PostgREST reader and the CLI are in
`scripts/`. A verifier wired straight into two live databases can only be tested by having
two live databases, which in practice means it is tested once, by hand, on the day it is
written. Every tier here is tested against the corruption it claims to catch.

Two things it does that matter more than they look. The checksum canonicalises timestamps
to epoch milliseconds **on both sides**, because Postgres sends
`2026-07-27T10:00:00+00:00` and SQLite holds an integer; without that every dated table
reports a permanent false mismatch, and a verifier that cries wolf gets ignored on the one
run that mattered. And `ts()`/`bool()` throw rather than defaulting: a date silently
becoming 1970, or a flag silently becoming false, is a post that never publishes and
nobody can explain.

**Not yet done, and it is the honest gap: the two sides have never met.** Every part is
tested in isolation; an end-to-end run needs the dev Postgres stack up. Tracked in
`TASKS.md`, and production is not where it gets tried first.

## 2026-07-27 — M1: analytics, and the six SQL functions are gone

All six plpgsql functions reimplemented in TypeScript. **401 tests pass, 0 fail.**

The hard part was never the aggregation, it was `date_trunc(bucket, created_at at time
zone tz)`. SQLite has no timezone database, and a fixed offset is wrong in general because
a DST day is 23 or 25 hours long, so stepping by 86,400,000 ms slides every later bucket by
an hour. Boundaries are now computed in TypeScript with `Intl.DateTimeFormat` and handed to
SQLite as explicit `[lo, hi)` pairs, which leaves the counting where the indexes are.

**That code had a real bug and its own test found it.** The first formatter used
`hour12: false`, under which a local midnight renders as hour "24" of the PREVIOUS day.
That is exactly the instant day and week buckets start on, so the computed offset was a full
day out and the fall-back day came back 23 hours long instead of 25. `hourCycle: 'h23'`
fixes it; 16 tests now cover both transitions, Monday week starts, and the label formats.

Two more things worth naming. Channels are folded in TypeScript over distinct
(host, visitor) pairs, because the obvious shape (per-host counts summed by channel)
double-counts anyone who arrived from two hosts in the same channel. And
`analytics_facet`'s exception turned out unnecessary: three complete SQL literals picked
from a fixed map do the job, so the no-assembled-SQL rule holds everywhere with no
exception at all.

Invariant 7 exists now: analytics writes buffer and flush every 2 seconds or 200 rows, in
one transaction, never from a handler.

## 2026-07-27 — M1: newsletter and the small modules. Only analytics left

`nodemailer` joins `sharp` as the second runtime dependency, then `activity`, `series`,
`scheduled`, `media-refs`, `newsletter-log`, `subscribers`, `mail`, `broadcast` and
`comment-notify`. **361 tests pass, 0 fail**, typecheck and file-size clean.

**The port found a schema bug, which is the point of doing it this way.**
`integration_keys.smtp_secure` had been translated as `integer not null default 1`, but the
Postgres column was nullable and `mail.ts` reads NULL as "not chosen, infer from the port".
With NOT NULL DEFAULT 1, any install that had ever saved an unrelated key on that shared
row (one Turnstile site key is enough) would resolve `secure = true`, so a port-587
STARTTLS server would quietly stop accepting mail with nothing in the UI to explain it.
Column is nullable again, with the regression case named after the bug.

`purgeAndWarm` loses its second half. The frozen tree re-warmed the origin after a purge
because Next's ISR cache was on disk and a cold render cost a visitor real time; there is
nothing to warm when the cache is an in-process Map and a miss is a sub-millisecond SQLite
read. `newlyLive` itself is untouched and its 6 tests moved verbatim, so the definition of
"went live" did not move with the plumbing.

Two more pure test files moved unchanged (`scheduled`, `series-order`). The frozen
`newsletter-log.test.ts` did not: it mocked the query builder, and the replacement runs the
same folds against real rows.

Left in M1: `analytics` (with the six SQL functions), the `og` database parts, `mcp/*`,
and the importer.

## 2026-07-27 — M1: the content core on SQLite. Posts, terms, comments, media, settings

`sharp` added as 2.0's first runtime dependency, then `image` (moved verbatim, 6 tests),
`files`, `media` + `finalize`, `settings`, `comments` and `posts` + `post-terms`.
**`bun run check:all` is green: typecheck clean, 298 tests pass, 0 fail.** Every `@/lib/*`
import in the moved tree now resolves inside 2.0.

The largest shape change is taxonomy: `categories`/`tags` were two Postgres `text[]`
columns and are now the `post_terms` junction. That deletes the one read-modify-write the
frozen tree documented as an accepted last-write-wins risk; a site-wide rename is two
statements, and the collision-merge falls out of the primary key instead of an array
de-dupe. 13 tests cover it, including the merge.

Search needed a guard the old stack gave for free: PostgREST's `websearch` parsed user
text, while a raw FTS5 `match ?` throws a syntax error on `C++`, a stray quote or a bare
`OR` — which would have shown up as a search that silently returns nothing. Every word is
now a quoted phrase. Ordering deliberately stays date-desc: BM25 is an allowed parity
exception that was NOT taken during the port, so a ranking change cannot be mistaken for a
port bug.

`soft-delete.test.ts`, the mock that hand-wrote a filter engine to prove Invariant 6, is
replaced by real rows in a real table. The comment tests keep `buildCommentTree` verbatim
and rebuild only the `addComment` guards, which now prove depth comes from the STORED
parent rather than the caller.

**Measured while here, and it contradicts a headline claim:** `bun build --compile` bundles
sharp's JavaScript but not its native module, so the compiled binary throws
"Could not load the sharp module" on the first image call, from any working directory.
"One executable" is really "one executable plus a native module directory". The risk
register predicted it; it now says so with evidence, and M4 has to pick a shape.

## 2026-07-27 — M1: the first six `db()` modules on SQLite, and the query-builder mocks deleted

`store/query.ts` (`one`/`all`/`run`/`tx`, deliberately not a query builder), `server/cache.ts`
(`clearCache()`, Invariant 1 in its 2.0 form), then `integration-keys`, `slugs`, `redirects`,
`revisions` and `pages` rewritten off `@supabase/postgrest-js` onto `bun:sqlite`. Signatures
and semantics unchanged; the functions stay `async` although the driver is synchronous,
because their callers already await them.

**39 new tests, all against a real SQLite database.** The frozen tree had to mock the
PostgREST builder, and `soft-delete.test.ts` went as far as hand-writing a filter engine,
i.e. a second unverified copy of the database's behaviour. That is now deleted: a read path
that drops `liveOnly` fails because SQLite really returns the trashed row. Suite: 223 pass,
0 fail.

Two deviations from pure motion, both forced by the storage change and both recorded in the
ledger: revisions order by `saved_at desc, id desc` (Postgres had microsecond timestamps,
these are milliseconds, and an untied ORDER BY would let the trim delete the wrong
snapshot), and `saveIntegrationKeys` merges in TypeScript rather than assembling a SET
clause from the payload.

`settings` did not move: it needs `files.renderLogo`, which needs `sharp`, which would be
2.0's first runtime dependency and deserves its own decision rather than being smuggled in
under a data-layer commit. So `email-brand.test.ts` is still blocked.

Typecheck errors: 11 to 6, all three remaining ones (`posts`, `settings`, `media`).

## 2026-07-27 — M1: 33 modules and 184 tests moved, suite green

The slice ADR 0005 was betting on. 2,412 lines of pure logic plus 4,983 lines of locale
data moved into `v2/`, and **184 tests pass under `bun test` from a suite written for
vitest, without a single assertion touched.**

Total edit cost: 46 import specifiers across 43 files. 28 were `@/lib/<name>` (2.0 has
modules, not a `lib/` directory) and 18 repointed `from 'vitest'` to a local shim that maps
vitest's call shapes onto `bun:test`. No module body and no test body changed.

Two things went wrong and are worth keeping. The first `tsconfig.json` enabled
`noUncheckedIndexedAccess`, which the frozen tree does not have; it produced ~20 errors in
code that compiles cleanly at source, converting a pure-motion diff into a rewrite.
Reverted, and tightening is now a task for after the port. The second: `prerender.ts` was
copied into `server/` when it is browser code, which the DOM globals exposed immediately.
Pulled back out and recorded, since it becomes part of `assets/js/core.js` in M2.

`scripts/port/LEDGER.md` records every file moved, every file left behind with its reason,
and the one test waiting on a dependency, so nothing can be dropped silently.

Remaining typecheck errors: 11, every one tracing to the 6 modules not yet ported.

## 2026-07-27 — M1 started: Bun installed, SQLite schema live and tested

Bun 1.3.14 installed via winget. Three assumptions checked against the real runtime before
writing code: FTS5 `remove_diacritics 2` folds Vietnamese (`"lap trinh"` matches
`Lập trình`), `Bun.password` is argon2id, and `generate_series` is **not** compiled in.
The last one costs nothing because the analytics design already computes bucket boundaries
in TypeScript, but it is now recorded in `v2/docs/01-schema.md` rather than waiting to be
discovered halfway through.

`v2/` scaffolded. The Postgres schema (612 lines) translated to two SQLite files and
applied at boot inside a transaction. Eight tests green, covering the parts SQLite is picky
about: the FTS index follows insert, update and delete; `AUTOINCREMENT` stops a purged
comment id being reissued under live replies; `post_terms` cascades.

One real bug found by the test that calls `openDatabases` twice: the second call leaked the
first pair of file handles. Windows surfaced it immediately as EBUSY; on Linux it would
have leaked descriptors silently.

## 2026-07-27 — Documentation layout rebuilt to the four-homes standard

Four homes adopted ([ADR 0010](../docs/decisions/0010-four-homes-doc-layout.md)). `ROADMAP`
and `audit/` moved into `state/`, the two dated files in `docs/` split by kind (the admin
design contract stayed and lost its date, the worklog became a report), ten ADRs written
covering the last month including the one that reversed a day later, and
`scripts/checks/docs.mjs` added to hold the layout. `CLAUDE.md` cut from 275 lines to a
router. Splitting `features.md` into per-module specs deferred with a reason.

## 2026-07-27 — M0.5: parity checklist

`v2/docs/07-parity.md`, 214 items, drawn from `/admin/help`, `docs/features.md` and the
invariants. Marks the behaviours that are easy to lose and have no test, and states its own
gaps so a fully ticked file is not mistaken for proof.

## 2026-07-27 — M0 shipped to production (`58cf8f9`)

`opsz` pinned at 18 ([ADR 0009](../docs/decisions/0009-pin-optical-size-axis.md)): preload
set 97,588 to 46,212 B. Speculation Rules added, and with them `lib/prerender.ts`, because a
prerendered page runs its JavaScript at speculation time and `Track` would have recorded a
pageview on every hover. The CSS split turned out to be already correct, verified in the
build rather than assumed.

Corrected the same day: an intermediate claim that the plan's font premise was false came
from a local build reading a dev database whose settings differ from production.

## 2026-07-27 — Quire 2.0 retargeted from Go to Bun

[ADR 0005](../docs/decisions/0005-rewrite-in-bun-hono-sqlite.md) supersedes
[0004](../docs/decisions/0004-rewrite-in-go-on-sqlite.md) after one day. Seven specs written
under `v2/docs/`; `go/` marked superseded with a record of what was salvaged. Admin stays
React ([0006](../docs/decisions/0006-admin-stays-react-spa.md)), Google login goes
([0007](../docs/decisions/0007-self-hosted-password-totp-auth.md)), Tailwind leaves the
public site ([0008](../docs/decisions/0008-hand-written-css-no-tailwind-public.md)).

## 2026-07-26 — v1.5.0 released, then frozen

Newsletter as a first-class subsystem, a real dev stack, a security pass, and the
`SUPABASE_*` to `POSTGREST_*` env rename. The tree was frozen the same day
([ADR 0003](../docs/decisions/0003-freeze-v1-rewrite-as-v2.md)) and the SaaS direction
dropped ([ADR 0002](../docs/decisions/0002-no-saas-single-instance.md)).

Earlier history: `CHANGELOG.md` (releases) and `state/audits/` (review passes).
