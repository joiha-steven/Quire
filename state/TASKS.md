# Tasks

In order. A task leaves this file when it is done and lands in `WORKLOG.md`.

## Now

- [ ] **M3 — admin, API and the rest.** Auth rebuilt per `v2/docs/06-auth.md`; 57 of 63
      admin API routes moved; `check:routes` enforcing Invariant 4. 900 tests.
      **The admin INTERFACE does not exist yet — 0%.** Not one route renders `/admin`.
      The frozen tree has 14 admin route folders and 68 components behind them, and the
      plan ([ADR 0006](../docs/decisions/0006-admin-stays-react-spa.md)) is to build them as a
      static React SPA embedded in the binary rather than port them to vanilla. The JSON
      API they will talk to is the part that is done.
      - [ ] **The admin SPA.** The largest single piece left. Needs a browser to build
            against, which is why it waited.
      - [ ] **Backup (6 routes + `lib/{backup,gdrive,backup-state}.ts`).** Nothing is
            ported: `/api/cron` currently answers `backup: { ran: false, error: 'not yet
            ported' }`. The Drive round trip needs a real OAuth client and refresh token.
            The pure parts can be ported and unit-tested first.
      - [ ] **The MCP transport (`/api/mcp`) and its tools.** The OAuth layer is done; the
            transport is not. `mcp-handler` is Next-specific, so Streamable HTTP has to be
            wired to `@modelcontextprotocol/sdk` directly. A rewrite, not a port.
      - [ ] **`Turnstile`**, with the comment form's configuration. The last unported island.
- [ ] **Decide how the binary ships, now that `sharp` is a dependency.** Measured
      2026-07-27: `bun build --compile` bundles sharp's JavaScript but NOT its
      `@img/sharp-<platform>` native module, so the compiled binary throws on the first
      image call from any working directory. Options: ship `node_modules/@img/*` beside the
      binary, or run from source with `bun src/index.ts` (which is what staging does).
      Needed by M4, not before.

## Next

- [ ] **M4 — cutover**, then keep the frozen tree runnable for 3 to 6 months against a
      read-only copy so "did we lose something?" is answerable by comparison.
      Re-run `import-v1` once more at cutover.
- [ ] **Tighten `v2/tsconfig.json` after the port finishes.** It currently matches the
      frozen tree exactly (`strict`, nothing beyond it). `noUncheckedIndexedAccess` was
      tried during M1 and reverted: mid-port it turns a pure-motion diff into a
      motion-plus-rewrite diff across every moved file, which is what the porting rule
      exists to prevent. Turn it on as one reviewable pass once nothing is left to move.

## Public design: the gaps left on purpose

The design was ported and measured against v1 on 2026-07-28 (see `WORKLOG.md`), and the
owner called it good enough to move on from. These are what is knowingly still off, so
nobody has to rediscover them by eye:

- [ ] **The search page is a different surface.** v1 runs a client component that filters
      an in-memory index as you type; 2.0 server-renders FTS5 results with a heading and a
      result count. Both work, neither looks like the other.
- [ ] **Numbered pagination is prev/next only.** A deliberate simplification, already on
      the ledger — but on this blog `features.infiniteScroll` is on, so no pager renders
      at all and it is invisible either way.
- [ ] **`.card-thumb` (grid-view thumbnails) is not ported.** Grid view is off on this
      blog, so the markup is never reachable; it becomes real work only if the owner turns
      `features.gridView` on.
- [ ] **The palette switcher island is not ported.** `enabledPalettes` has one entry, so
      the control is hidden. Porting it is pointless until a second palette is enabled.
- [ ] **Dark mode shows one light frame** before the island applies the saved choice. 2.0
      has no inline script anywhere and that property is TESTED; the frozen tree used a
      pre-paint inline script. A cookie would let the server render it, but the page cache
      is keyed by URL alone (Invariant 1), so a cached page would carry whichever mode the
      first visitor happened to have.
- [ ] **A static page's body sits 8px lower** than v1 (`mt-10` applied where v1 uses
      `mt-8`). One line of CSS; not worth a deploy on its own.
- [ ] **Book mode paginates to 7 spreads where v1 makes 6.** The spread geometry matches
      to 6px; the difference is leading inside the columns.
- [ ] **An extra rule sits between the taxonomy and the related posts.**
- [ ] Sub-pixel wrap differences in the rail and the tag cloud, from a 1px rail width.

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

## Done

- [x] **M1 — foundations and data layer.** Done 2026-07-27. SQLite schema; ~6,500 lines of
      pure logic and its tests moved unchanged; every `db()` call site on `bun:sqlite`; all
      six plpgsql functions reimplemented; `import-v1` with its four verification tiers.
- [x] **Run `import-v1` end to end against a live v1.** Done 2026-07-28. 74 posts, 4 pages,
      68 media, 246 term rows, 481 activity rows, 504 analytics events. All four tiers pass.
      **It found two real bugs that 51 unit tests could not**, both the same root cause in
      two different normalisers: a `jsonb` column arrives PARSED from PostgREST and is held
      as TEXT in SQLite, and neither `verify.ts` nor `checksum.ts` reconciled the two.
- [x] **M2 — public renderer.** Done 2026-07-27, and **re-done properly 2026-07-28** after
      the owner saw it: the first pass reproduced the theme tokens exactly and the LAYOUT
      not at all. See `WORKLOG.md` for what was actually wrong, which was mostly not the
      missing sidebar.
- [x] **Staging.** `next.manhhung.me`, own user, own port, own data dir, beside the live v1.
