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

## Waiting on a dependency

| File | Blocked by | Why |
|---|---|---|
| `news/email-brand.test.ts` | `settings.ts` | Imports `DEFAULT_SETTINGS`. `settings.ts` is a MIXED module: `DEFAULT_SETTINGS`, `typographyToCss`, `fontToCss` and `resolveAppIcon` are pure, but `getSettings`/`saveSettings` touch the database. Splitting it now would violate the porting rule (move first, improve separately), so the test moves when settings does. |

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
| `posts`, `pages`, `revisions`, `media`, `files`, `settings`, `comments`, `subscribers`, `analytics`, `activity`, `redirects`, `series`, `slugs`, `scheduled`, `broadcast`, `mail`, `newsletter-log`, `integration-keys`, `revalidate`, `og`(db parts), `mcp/*` | The 132 `db()` call sites. Next slice of M1 |
