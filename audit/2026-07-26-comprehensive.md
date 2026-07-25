# Comprehensive audit — 2026-07-26

- **Version:** 1.4.37 (main @ `78b8a4c`)
- **Scope:** whole project. First pass since the 2026-06-23 audit (v1.1.5), so it covers
  everything shipped between: analytics v2, newsletter + broadcast, series, redirects, book
  mode, the WordPress import, the native migration, and this week's `postgrest-js` swap.
  Ran on the local Docker stack + read-only checks against the live instance.
- **Verdict:** sound, with one significant finding. The dependency tree carried **14 known
  vulnerabilities, 3 of them critical**, including an Auth.js advisory where a configuration
  error can make existence-based auth checks **fail open** — directly load-bearing for a blog
  whose entire admin gate is `auth()`. Patched to 4 remaining (0 critical), all documented
  below as either unexposed or unfixable upstream. One real responsive bug fixed. One
  accessibility defect found and measured but NOT changed: it needs an owner decision.

## 0. Baseline
- `npm run check:all` → exit 0 (tsc + lint + routes/filesize/no-any/no-direct-blob/token-bust
  + 34 test files, 261 tests)
- `npm run build` → exit 0; `/` is `○`, `/[slug]` is `●` (ISR), every `/admin/*` is `ƒ`
- `npm run check:consistency:live` **against production** → ok: 65 media + 1 files rows,
  317 referenced binaries vs 317 on disk, no drift in either direction

## 1. Security — one significant finding, patched

`npm audit --omit=dev` reported **14 vulnerabilities (3 critical, 7 high, 4 moderate)**. The
tree had drifted because `next` was pinned exactly (`"next": "16.2.9"`, no caret), so patch
releases never arrived. Fixed in this pass:

| Package | Was | Now | Why it mattered here |
|:--|:--|:--|:--|
| `next-auth` / `@auth/core` | beta.31 / 0.41.2 | beta.32 / 0.41.3 | **critical** — config errors can make existence-based auth checks fail open; `getToken()` throws on a malformed Bearer header (our `middleware.ts` calls it on every `/admin` + `/api` request) |
| `tar` | 7.5.16 | 7.5.22 | **critical** — parse DoS + infinite loop; `lib/backup.ts` unpacks restore archives |
| `next` | 16.2.9 | 16.2.11 | 10 high advisories incl. **middleware/proxy bypass on App Router + Turbopack** — the edge net behind Invariant 4 |
| `fast-xml-parser` | 5.9.3 | 5.10.1 | high — DOCTYPE entity-expansion reset; reached by the WordPress importer, which parses an uploaded WXR file |
| `sharp` | 0.34.5 | 0.35.3 | high — libvips CVEs. Note `next` bundles its OWN `sharp`; a top-level bump does not reach it, so an `overrides` entry was needed |
| `postcss` | 8.4.31 (nested) | 8.5.23 | high — path traversal via `sourceMappingURL`; also needed an `overrides` entry |

Two `overrides` were added to `package.json` (`postcss`, `sharp`) precisely because the
vulnerable copies were **nested inside `next`**, where a normal dependency bump has no effect.

**Remaining 4 (0 critical), all deliberate:**
- `nodemailer` 7.0.13 (high, 6 advisories) — **not exposed**. Every advisory is in an API this
  app never touches: `envelope`, `List-*` header comments, the message-level `raw` option,
  `jsonTransport`, the transport `name` option, and OAuth2 token fetch. `lib/mail.ts` calls
  `createTransport({host, port, secure, auth})` + `sendMail({from,to,subject,html,text})` and
  nothing else. The fix (9.0.3) is also **blocked upstream**: `next-auth@5.0.0-beta.32`
  declares `peerOptional nodemailer@"^7.0.7 || ^8.0.5"`, so forcing 9 makes `npm ci` fail for
  every self-hoster without `--legacy-peer-deps`. 8.0.11 is still inside the vulnerable range,
  so moving 7→8 buys nothing. Revisit when next-auth widens the peer range.
- `@modelcontextprotocol/sdk`, `mcp-handler`, `@hono/node-server` (moderate) — the only
  "fix" npm offers is a **downgrade** (`mcp-handler@1.0.4`), and the advisories carry no
  published title or detail. Nothing actionable.

Non-dependency security checks all pass:
- Every write/delete route calls `requireOwner()` — codified, 45 owner-gated / 16 public-exempt.
- Each `dangerouslySetInnerHTML` source re-verified: post/comment markdown escape-first
  (Invariant 5, pinned by tests); the footer goes through `renderInlineMarkdown`, which escapes
  the whole string first and protocol-checks hrefs; `customCss` strips `</style`; JSON-LD
  escapes `<`; palette CSS is built from hex-validated presets.
- `verifyPreview` length-checks before `timingSafeEqual` (no throw on a wrong-length token);
  `blob-local.resolveSafe` blocks path traversal; MCP + Drive HMACs compare in constant time.

## 2. Logic / correctness — pass
All seven invariants hold; their seam tests are green. Production data has zero media/blob
drift. The `supabase-js` → `@supabase/postgrest-js` swap (`78b8a4c`) was re-verified end to
end on the local stack this pass — read, write, `.rpc()`, and the redirect middleware.

## 3. Performance — measured, one real long pole

Lighthouse 12 (mobile, live site): **Performance 77 · Accessibility 96 · Best Practices 82 ·
SEO 92**. FCP 1.5s, LCP 5.1s, TBT 230ms, CLS 0.001.

LCP breaks down as TTFB 678ms + **render delay 4,428ms**, with zero load delay/time — so it is
not an image and not the server. Attribution, measured rather than guessed:

- **NOT the scroll-reveal.** Hypothesis tested and rejected: on a real load the above-the-fold
  `.reveal` cards report `opacity: 1`; only off-screen cards are hidden. The design is correct.
- **NOT font blocking.** Every `@font-face` sets `font-display: swap`; the LCP subsets are
  preloaded and arrive at 253ms on a fast link.
- **It is font WEIGHT on a slow link.** The LCP element is a post excerpt in Literata, which
  needs `literata-latin.woff2` (**107.5 KB**) plus `literata-vietnamese.woff2` (21.8 KB) — 129 KB
  before that text can paint in its real face. Under Lighthouse's simulated 4G that lands right
  where the render delay ends. On an unthrottled connection LCP equals FCP (580ms), which is why
  this never shows up in casual testing. Literata is a variable font carrying the full 200–900
  weight axis; the site uses a fraction of it. Subsetting the axis is the single highest-value
  perf change available. *Not done in this pass — it is a font-pipeline change that deserves its
  own verification.*
- **Cloudflare's bot challenge costs 422ms** of script bootup (`/cdn-cgi/challenge-platform/
  scripts/jsd/main.js`), out of 1,174ms total script evaluation. That is a dashboard setting
  (Bot Fight Mode), not app code — worth weighing against its value.
- The homepage ships 113 KB of HTML, **81.6 KB of which is the inline RSC flight payload**
  (each excerpt appears twice: once as markup, once as client-component props). It compresses
  to 29.7 KB on the wire, so the cost is main-thread parse, not bandwidth. This is the price of
  `infiniteScroll` handing the whole list to a client island so scrolling needs no network — a
  deliberate trade, recorded here with numbers so it can be re-judged.

ISR is intact; no public route slipped to `force-dynamic`.

## 4. Code quality — pass
No file over 400 lines, no `any`, no stray `console.log`/`TODO`/`@ts-ignore` — all codified.

## 5. Layout / visual — one bug fixed, one defect awaiting a decision

Swept every admin surface + the public pages at 1440px and 390px in headless Chromium,
checking for console errors, failed requests, horizontal overflow and tap-target size.

- **FIXED — `/admin/analytics` scrolled horizontally by 49px on a 390px phone.** `PageHeader`
  wrapped its actions in `shrink-0`, so Analytics' four range pills plus Export CSV could
  neither shrink nor wrap and pushed the page sideways. Now the actions row wraps
  (`kit.tsx`), the pills wrap within their group, and each label is `whitespace-nowrap` so
  nothing breaks mid-word. Verified at 0px overflow across six admin pages. The first attempt
  (wrap alone) fixed the overflow but split labels onto two lines — kept looking until the
  result was actually right, not just technically passing.
- **NOT CHANGED — every light palette fails WCAG AA on secondary text.** Measured all 12
  palette/mode pairs. All six **light** modes put `meta` text between **2.91:1 and 3.60:1**
  against their background, where AA at 14px requires 4.5:1; the six dark modes all pass
  (4.73–5.45). Two light palettes also fail on link colour: scifi 3.72:1, amber 3.58:1. This
  affects real reading surfaces — post meta lines, the footer, card excerpts. The minimal
  correction (same hue and saturation, value only) is computed and ready:

  | palette | mode | key | from | to | ratio |
  |:--|:--|:--|:--|:--|:--|
  | mono | light | meta | `#8c8c8c` | `#747474` | 4.56 |
  | sepia | light | meta | `#9a8c79` | `#776c5d` | 4.56 |
  | forest | light | meta | `#84907f` | `#6a7366` | 4.57 |
  | ocean | light | meta | `#7f8c99` | `#68737d` | 4.50 |
  | scifi | light | meta | `#74828f` | `#65717c` | 4.56 |
  | scifi | light | link | `#0e8aa0` | `#0c7b8e` | 4.52 |
  | amber | light | meta | `#918b82` | `#78736c` | 4.54 |
  | amber | light | link | `#c2710c` | `#a9620a` | 4.57 |

  Held back deliberately: this repo's own audit procedure flags §5 as "owner is very sensitive
  here", and these are brand colours. It is a taste-vs-AA call for the owner, not the auditor.

## 6. i18n — pass
All six locales stay key-complete (`satisfies`, covered by tsc in step 0). No UI strings were
added this pass; the fixes were CSS classes only.

## 7. Docs — pass
`CLAUDE.md`, `ARCHITECTURE.md`, `README.md`, `CONTRIBUTING.md`, `CHECKLIST.md`, `.env*.example`
and `docs/self-host-native.md` were all brought in line with the PostgREST rename in `78b8a4c`.
No credentials or instance data in tracked files.

## Changes shipped this pass
- `package.json` / `package-lock.json` — security updates + two `overrides` (see §1)
- `src/components/admin/kit.tsx` — `PageHeader` actions wrap instead of `shrink-0`
- `src/components/admin/AnalyticsView.tsx` — range pills wrap; labels `whitespace-nowrap`
- `audit/2026-07-26-comprehensive.md` (this report)

## Follow-ups
1. **Owner decision — light-palette contrast (§5).** Table above is ready to apply.
2. **Subset the Literata weight axis (§3)** — the one change that moves mobile LCP.
3. **Reconsider Cloudflare Bot Fight Mode (§3)** — 422ms of main thread on every page load.
4. **`middleware.ts` → `proxy.ts`** — Next 16 prints a deprecation warning on every build.
5. **`nodemailer` (§1)** — recheck when `next-auth` widens its peer range.
6. Carried over from 2026-06-23, still open: commenter `author_ip` is stored in plaintext with
   no retention policy. Admin-only and deliberate, but undocumented for readers.
