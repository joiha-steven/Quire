# Audit, 2026-07-29 — first pass over 2.0 after cutover

Snapshot. Write-only: not retro-edited.

Scope: correctness, the project's own hard rules, performance, and the public + admin
layout. Everything below was **measured** with headless Chromium against the origin
(`127.0.0.1:3100`), never through Cloudflare. The admin was driven on a throwaway instance
on port 3199 running from a `VACUUM INTO` snapshot of the live database, so no admin
request touched production.

## Found and fixed

### 1. Dark mode did nothing until the reader reloaded — LIVE

The worst of the three, and invisible to every test in the repository.

The three browser bundles were built as ESM and injected as plain `<script src defer>`.
That is a **classic** script: every top-level declaration lands on the shared global object.
Self-contained ESM has no `import` or `export` left to make that a syntax error, so the
bundles loaded happily and then stamped on each other. `core.js` and `post.js` each declare
a helper the minifier named `h`; `post.js` loads second and wins; `core.js`'s `apply()`
called it with the toggle button and a boolean, so switching theme called a DOM element as
if it were a function.

```
click "Tối"  →  TypeError: T is not a function
                  at h    (post.js:1:371)     ← a scroll-watch helper
                  at F    (core.js:1:5974)    ← apply()
                  at HTMLButtonElement.<anonymous> (core.js:1:6422)
                html class: ""     body background: rgb(252,252,252)   [unchanged]
                localStorage theme: "dark"    [stored, so a RELOAD looked fine]
```

Storing-then-failing is why it survived: anyone who clicked and then navigated saw dark
mode work. Fix: `format: 'iife'` — each bundle gets its own scope, 11 bytes each.

**Why nothing caught it.** Every test in `src/assets/js` imports the TypeScript source.
The shipped artifact had no test at all. `src/assets/bundles.test.ts` now tests the built
bundles, and deliberately asserts the minified name overlap still EXISTS rather than
pretending the names were made unique — the property that matters is the scope, not the
names.

### 2. Form controls did not inherit the page font

The second reset the frozen tree got free from Tailwind's preflight and the hand-written
CSS never reproduced. The first was block margins, found on 2026-07-28; this is the same
class of bug, one layer down.

| Control | Was | Now |
|---|---|---|
| `.code-copy` "Sao chép", on every code block | Arial 12px/normal | JetBrains Mono 12px/19.8px |
| `.to-top` "Lên đầu trang", every article | Arial 13.33px/normal | inherits |
| `.icon-btn` theme + menu, every page | Arial 13.33px/normal | inherits |

On a site whose own rule is "ONE typeface, no hardcoded sizes". `button,input,select,
textarea,optgroup{font:inherit}` in `public.css.ts`, plus an explicit family on
`.code-copy`, which lives inside `.prose pre` and would otherwise inherit the code face.

### 3. Admin tables were clipped on a phone, with no way to reach the rest

The card needs `overflow-hidden` for its rounded corners, and that was the only box.

```
390px viewport, /admin/analytics
  table 426px inside a 356px card
  last column "Độ sâu" (63%) at x=368..443   → past the edge, clipped, unscrollable
  nearest ancestor with overflow-x:auto → NONE
```

`/admin/log` the same. Fixed in the shared `TableFrame` (covers analytics, log, comments,
subscribers and the four Help tables) plus the four components that hand-roll the same
wrapper. Verified after: `canScroll: true`, scrollWidth 426 > clientWidth 356.

## Checked and clean

- **`any`**: none in production code. **SQL string building**: none; every interpolation is
  a test's hardcoded table list, a pragma, or a `VACUUM INTO` path from `mkdtemp`.
- **Secrets**: `password_hash`, `totp_secret` and `recovery_codes` never leave
  `src/auth/{users,recovery}.ts`; `toUser()` exposes `totpEnrolled` as a boolean.
- **i18n**: 96 site keys and 643 admin keys, identical across all six languages.
- **No inline script** anywhere, pinned by `src/web/app.test.ts`.
- **Admin**, 11 routes × 2 widths: no console error, no failed request, no page-level
  horizontal scroll, every control inheriting the admin face.
- **Book mode**: 16 spreads, page turns 0 → 1292 → 2584. Even, so the one-gap-per-turn
  drift stays fixed. **Search overlay** opens and takes focus.
- **CLS 0** on posts and pages, 0.013 on the home page. **LCP 44-56ms** at the origin, and
  the element is the reading-font paragraph the Literata preload exists for — so the
  preload rule ("preload only what the LCP text needs") is doing exactly what it claims.

## Noted, not changed

- **45.8 KB of CSS is inlined into every page** (13.8 KB gzipped, of a 29.6 KB page). It
  buys one less round trip on a cold visit and costs ~14 KB on every page after the first,
  uncached. A deliberate-looking trade-off with no note anywhere saying it was decided.
- **The app sends no `content-encoding`.** nginx gzips in front of it, so the live site is
  fine, but a self-hoster who puts it behind something that does not compress serves 104 KB
  of HTML per page and nothing warns them.
- **`--font-mono` is referenced in `prose.css.ts` and never defined**, so code always
  resolves to the `ui-monospace` fallback. Harmless today; a dead token either way.
