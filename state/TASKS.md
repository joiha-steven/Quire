# Tasks

In order. A task leaves this file when it is done and lands in `WORKLOG.md`.

## Now

- [ ] **M1 — foundations and data layer** (`v2/docs/00-plan.md`). Done: SQLite schema,
      ~6,500 lines of pure logic and its tests moved unchanged, and the whole content core
      on `bun:sqlite` (`posts` + `post-terms`, `pages`, `revisions`, `comments`, `media` +
      `finalize`, `files`, `image`, `settings`, `slugs`, `redirects`, `integration-keys`,
      plus `store/query.ts` and `server/cache.ts`), and the newsletter cluster
      (`subscribers`, `newsletter-log`, `mail`, `broadcast`, `comment-notify`) with
      `activity`, `series`, `scheduled` and `media-refs`. Left: `analytics` and its six
      SQL functions, the `og` database parts, `mcp/*`, and the importer with its four
      verification tiers.
- [ ] **Decide how the binary ships, now that `sharp` is a dependency.** Measured
      2026-07-27: `bun build --compile` bundles sharp's JavaScript but NOT its
      `@img/sharp-<platform>` native module, so the compiled binary throws on the first
      image call from any working directory. Options: ship `node_modules/@img/*` beside the
      binary, or run from source with `bun src/index.ts`. Needed by M4, not before.

## Next

- [ ] **M2 — public renderer.** 13 server components to Hono JSX, 23 islands to vanilla,
      hand-written CSS ([ADR 0008](../docs/decisions/0008-hand-written-css-no-tailwind-public.md)).
      Gate: article bodies byte-identical, 0 KB JS.
- [ ] **M3 — admin, API and the rest.** Admin SPA embedded, 61 API routes moved, auth
      rebuilt per `v2/docs/06-auth.md`. Gate includes a 30-flow headless tour.
- [ ] **M4 — cutover**, then keep the frozen tree runnable for 3 to 6 months against a
      read-only copy so "did we lose something?" is answerable by comparison.

- [ ] **Tighten `v2/tsconfig.json` after the port finishes.** It currently matches the
      frozen tree exactly (`strict`, nothing beyond it). `noUncheckedIndexedAccess` was
      tried during M1 and reverted: mid-port it turns a pure-motion diff into a
      motion-plus-rewrite diff across every moved file, which is what the porting rule
      exists to prevent. Turn it on as one reviewable pass once nothing is left to move.

## Deferred, with a reason

- [ ] **Split `docs/features.md` (606 lines) into one spec per module** under `docs/specs/`.
      Required by [ADR 0010](../docs/decisions/0010-four-homes-doc-layout.md) and not done
      with it: it is a mechanical 600-line split across ~20 areas with real risk of dropping
      content, and roughly 30 cross-references (including the `CLAUDE.md` DEBUG ROUTER)
      point into it. It deserves a focused pass with a content-accounting check, not the
      tail end of a long session.
- [ ] **Server-render the analytics charts as SVG.** `AnalyticsView` + `AnalyticsPageDetail`
      are ~13 KB of React producing charts that server-rendered SVG would produce with no
      client JavaScript and less code. Highest-value cleanup left in the admin, but out of
      scope for v2.0 parity.
- [ ] **Passkeys / WebAuthn** as a fast path beside password + TOTP
      ([ADR 0007](../docs/decisions/0007-self-hosted-password-totp-auth.md)).

## Verify before trusting

- [ ] **Re-measure the 182 KB JavaScript figure** in `v2/docs/00-plan.md`. It came from the
      Go documents, was measured once, and the font figure beside it needed correcting.
