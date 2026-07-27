# Tasks

In order. A task leaves this file when it is done and lands in `WORKLOG.md`.

## Now

- [x] **M1 — foundations and data layer** (`v2/docs/00-plan.md`). **Done 2026-07-27.**
      SQLite schema; ~6,500 lines of pure logic and its tests moved unchanged; every
      `db()` call site on `bun:sqlite`; all six plpgsql functions reimplemented; and
      `import-v1` with its four verification tiers. 473 tests, `check:all` green.
- [x] **Run `import-v1` end to end against a live v1. DONE 2026-07-28.** Read-only against
      the live PostgREST on the web box, writing a fresh SQLite for the staging install:
      74 posts, 4 pages, 68 media, 246 term rows, 481 activity rows, 504 analytics events.
      All four verification tiers pass. **It found two real bugs that 51 unit tests could
      not**, both the same root cause in two different normalisers — a `jsonb` column
      arrives PARSED from PostgREST and is held as TEXT in SQLite, and neither
      `verify.ts` nor `checksum.ts` reconciled the two. Re-run once more at cutover.
- [ ] **Decide how the binary ships, now that `sharp` is a dependency.** Measured
      2026-07-27: `bun build --compile` bundles sharp's JavaScript but NOT its
      `@img/sharp-<platform>` native module, so the compiled binary throws on the first
      image call from any working directory. Options: ship `node_modules/@img/*` beside the
      binary, or run from source with `bun src/index.ts`. Needed by M4, not before.

## Next

- [x] **M2 — public renderer. DONE 2026-07-27.** Every public route, feed and machine
      surface; 21 of 23 islands ported, 2 deleted in favour of CSS (`ReadingProgress`,
      `RevealFallback`), `RailToggle` made unnecessary by the rail layout, `Turnstile`
      deferred to M3 with the comment form's configuration. 685 tests.
      core.js 5,186 b and post.js 7,860 b, both enforced by `scripts/build-assets.ts`.
      NOT visually verified: no browser could be launched in the build environment.
- [ ] **M3 — admin, API and the rest.** Admin SPA embedded, 61 API routes moved, auth
      rebuilt per `v2/docs/06-auth.md`. Gate includes a 30-flow headless tour.
      **Auth done, 55 of 61 routes moved (2026-07-28).** Password + TOTP + recovery codes,
      the sign-in and enrolment screens, `bun run user`, `check:routes` enforcing
      Invariant 4, and every content, media, newsletter, ops and MCP-OAuth route. 900 tests.
      **What is left needs things this machine does not have:**
      - [ ] **Backup (6 routes + `lib/{backup,gdrive,backup-state}.ts`).** The Google Drive
            round trip needs a real OAuth client and refresh token. The pure parts can be
            ported and unit-tested first; the round trip has to be proved on the box.
      - [ ] **The MCP transport (`/api/mcp`) and its tools.** `mcp-handler` is Next-specific,
            so Streamable HTTP must be wired to `@modelcontextprotocol/sdk` directly. A
            rewrite, not a port — and testable in-process once written.
      - [ ] **The admin SPA**, and `Turnstile` with the comment form's configuration. This
            is the piece that genuinely needs a browser.
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
