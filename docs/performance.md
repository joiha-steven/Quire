> Split from CLAUDE.md — the **resource-loading law**: how fonts, CSS, and JS reach a
> reader. One rule set, applied system-wide (every language, every font preset, every
> uploaded font). Touching the root layout, `lib/themes.ts` font helpers, the stylesheet
> entries, or adding a client island? Read this first. The *why* is in
> [`v1/ARCHITECTURE.md`](../v1/ARCHITECTURE.md) "Resource loading" — the reasoning was
> written for the Next implementation and carried over to 2.0 unchanged.

# Performance — resource loading (fonts · CSS · JS)

One principle underlies all three: **a reader downloads only what the visible page needs,
when it needs it — nothing for a feature that's off, a surface they're not on, a font glyph
they won't see, or a browser they're not using.** The public money path is the reading
page; the admin is never on its critical path.

## Fonts — preload ONLY what the LCP text needs

The LCP element on a post is the **title**, set in the **reading font** (`--font-reading`).
The **chrome font** (`--font-sans`: header/footer/rail/meta/admin) is never the LCP element.
All faces are self-hosted, subset by `unicode-range`, and declared `font-display: swap`, so
the title always paints instantly in a fallback and the web font swaps in. `<link
rel="preload">` exists ONLY to remove that one swap on the LCP title — so we preload exactly
the file(s) that paint it, and nothing else.

**The rule — one place, `fontPreloadHrefs(fontPreset, language, hasCustomFont)` in
`lib/themes.ts`, called once in `app/layout.tsx`:**

| Case | Preload |
|---|---|
| Built-in reading font, latin locale (`en`, `de`) | `‹slug›-latin.woff2` |
| Built-in reading font, `vi` | `‹slug›-latin.woff2` **and** `‹slug›-vietnamese.woff2` (a VN title needs both unicode-ranges) |
| Built-in reading font, CJK locale (`ja`, `zh`, `ko`) | **nothing** — the built-ins ship no CJK glyphs, so the title renders in a system font; a latin preload it won't use only steals bandwidth |
| **Uploaded custom font** (`settings.customFont`) | **nothing** — the face is unsubsetted (whole charset, often large); a high-priority preload would contend with the render-blocking CSS and hurt LCP. It still wins `--font-reading` via `fontToCss`; `swap` covers the paint |
| **Chrome font** (Inter default, IBM Plex Mono, "reading") | **NEVER** — not the LCP element; loads at normal priority via its `@font-face` and swaps in |

### Variation axes are trimmed, not shipped whole

`scripts/subset-font-axes.py` (needs `pip install fonttools brotli`) rewrites the bundled
files: `wght` clamped to 400-700, **`opsz` pinned to 18**. Run it after replacing any font
file, and keep the `@font-face` `font-weight` range in `globals.css` truthful.

The `opsz` axis doubled the two book serifs. Literata carries 42% fewer glyphs than Inter
yet was 2.2× its size, entirely because `gvar` must store deltas for every glyph across
the optical range:

| File | Before | After | |
|---|---|---|---|
| `literata-latin` | 80,660 | **37,560** | −53% |
| `literata-vietnamese` | 16,928 | **8,652** | −49% |
| `sourceserif-latin` | 83,240 | **36,160** | −56% |
| **`manhhung.me` preload set** (Literata, `vi`) | **97,588** | **46,212** | **−53%** |

That last row is the whole point: production runs Literata with `language: vi`, so the LCP
preload is `literata-latin` **plus** `literata-vietnamese`, and this change takes **51 KB**
off the critical path.

> ⚠️ **Measure production, not a local build.** `.env.local` points at a dev database whose
> `settings` row differs from the live one. During this work a local build reported the
> preset as Inter with `lang="en"`, which is not what the site serves. Anything that depends
> on `settings` (font preset, language, palette, enabled features) must be read off the box:
> `curl -s http://127.0.0.1:3000/ | grep -o -- '--font-reading:[^;}]*'`.

Narrowing the range instead was measured and is not competitive (`12-24` still costs
58 KB). 18 was chosen by rendering 14/18/24 side by side: body copy is 18px, so pinning at
18 leaves the body **identical** to what `font-optical-sizing: auto` produced, and body is
where reading time goes. The cost is a 36px title rendering in the 18pt design, slightly
heavier than before. `font-optical-sizing: auto` stays in `globals.css` because an
uploaded custom font can still have the axis.

Hard invariants (also in [`conventions.md`](./conventions.md) typography):
- **Self-hosted only.** No `next/font/google`, no build/runtime fetch to Google (broke
  offline/CI). Files in `public/fonts/`, subset `-latin` / `-latin-ext` / `-vietnamese`.
- **Never preload `latin-ext` or a specific weight.** Built-in reading fonts are variable
  (one file per subset carries every weight); `latin-ext` glyphs are rare and load on demand.
- **Never preload the chrome font**, in any config. (Regression to watch: a "no swap flash
  on chrome" instinct will try to re-add it — don't; chrome is not LCP.)
- Changing which subsets exist? Keep `fontPreloadHrefs` and the `@font-face`
  `unicode-range` blocks (`globals.css`) in sync.

## CSS — one hashed sheet, plus the settings inline

**Measured 2026-07-29.** The whole stylesheet used to be inlined into every page. That
removes one round trip on a COLD visit and charges for it on every visit after: of the
48.7 KB assembled per page, **42.6 KB (13.8 KB gzipped) was byte-identical everywhere**
and only 6.1 KB (1.7 KB gzipped) actually varied with the owner's settings. Reading three
articles re-sent 41 KB of gzipped CSS carrying one page's worth of information, and none of
it could be cached, because it was not a resource.

So the two halves are split at exactly that seam:

| Half | Where | Cost |
|---|---|---|
| Static rules (`PUBLIC_CSS`) | `<link rel="stylesheet" href="/assets/site.‹hash›.css">` | one request, `immutable` for a year; the hash changes when the bytes do |
| Settings (fonts, `--shell-w`, rail geometry, palette, type roles, custom CSS) | inline `<style>`, immediately AFTER the link | ~1.7 KB gzipped per page |

The order is the load-bearing part: the inline block is allowed to WIN, so it has to come
second, exactly where it sat when the two were one string.

Measured after (origin, `127.0.0.1`, median of three cold loads): HTML per page **60.3 KB
→ 20.7 KB** on the home page and **65.0 KB → 25.4 KB** on a post; the sheet is discovered
at ~11 ms and done at ~18 ms; LCP 100 ms home / 132 ms post; CLS 0. A loopback measurement
cannot price the extra round trip a real network charges on the FIRST visit — that is the
cost this trade accepts, and it is paid once.

## The two entries — a reader never loads admin CSS

Tailwind v4 scans content globally, so a single stylesheet would ship every admin utility
(editor, tables, forms) to readers. Split by surface:

- **`app/globals.css`** — PUBLIC, loaded on every page by the root layout. `@import
  "tailwindcss" source(none)` + explicit `@source` for the public tree only (`(blog)`,
  `components/{blog,theme,ui}`, the shared error views, root layout). Holds shared runtime
  tokens/fonts/`.prose` (loaded on admin too, so defined once).
- **`app/admin/admin.css`** — ADMIN, loaded only by `admin/layout.tsx`. `@source` the admin
  tree (`admin/**`, `components/admin`) + admin-only chrome (`.ProseMirror`, `.admin-canvas`,
  typewriter caret, colour picker).
- **`app/theme.css`** — the compile-time tokens BOTH entries need (`@custom-variant dark`,
  `@theme inline`), imported by each so both compile the same token utilities.

**Rule:** a new PUBLIC route/component using a new utility → extend `globals.css`'s `@source`
list (or the class won't emit). NEVER put an admin-only utility/chrome rule in `globals.css`.

## JS — ship only what's used, only when it's used

1. **Feature-gate every island.** An island (and its JS) renders ONLY when its feature/data
   is present: `features.toc && <Toc/>`, `imageUrls.length > 0 && <Lightbox/>`,
   `palettes.length > 1 && <PaletteToggle/>`, `showComments && …`. A feature the owner turned
   off ships zero client JS.
2. **Lazy-load below-the-fold islands.** Wrap in `next/dynamic` + an `IntersectionObserver`
   so the chunk fetches only as it nears the viewport (see `CommentsLazy` → defers the
   comment island **and** its `next-auth/react` dependency). The page stays static/ISR.
3. **Heavy libs stay off the reader.** `@tiptap`/ProseMirror, `shiki`, `turndown`, and
   `marked` are admin-only or run server-side (Shiki highlights at render → zero client JS).
   Never import them into a public/client component.
4. **No third-party analytics/tag JS on the reader.** Built-in cookieless analytics only
   (`Track`/`ScrollDepth` → `/api/track`). (Edge injections — e.g. Cloudflare Web Analytics
   / Bot JS Detections — are a dashboard concern, not code, and are redundant here.)
5. **Scroll-reveal is pure CSS first.** `.reveal` cards ease in via `animation-timeline: view()`
   (globals.css) — zero JS on Chromium. `RevealFallback` (an IntersectionObserver island, gated
   on `motion.enabled`) covers ONLY browsers without scroll-timeline (Safari/Firefox); the root
   layout arms `data-reveal-js` pre-paint just there, so Chromium never ships or runs its JS.
6. **The framework baseline** (react-dom + Next App Router, ~130 KB gzip) and the RSC flight
   payload are the floor; don't chase Lighthouse "legacy/unused JS" inside those vendor
   chunks — Turbopack doesn't strip them via `browserslist`, and they're not on the LCP path.

## Navigation: prerender on hover, zero runtime JS

Every public HTML response carries a `Speculation-Rules` header pointing at
`/speculation-rules.json` ([`src/web/speculation.ts`](../src/web/speculation.ts), set in
[`src/web/cache-headers.ts`](../src/web/cache-headers.ts)) with `eagerness: "moderate"`, so
Chrome prerenders a same-origin link when the reader hovers it. A click then paints an
already-rendered document. This is the largest perceived-speed win available on a reading
site and it costs no runtime JS.

**A header, not an inline `<script type="speculationrules">`.** The frozen tree used the
inline form. 2.0 ships no inline script on the public site, which is what lets the
recommended CSP omit `unsafe-inline` from `script-src`, and an inline speculationrules block
is governed by `script-src` like any other. The header keeps both.

Excluded from prerendering: `/admin/*`, `/api/*`, `/uploads/*`, `/preview/*`, `/og*`, plus
`[rel~=nofollow]` and `[download]` links. The header itself is only set on a public HTML 200,
so the owner's surfaces never offer it at all.

> This shipped on 2026-07-29 and was absent before then, while both this file and
> `spec/04-frontend.md` described it as present. What the port DID carry over was
> `whenActivated` — the guard that exists only because a prerendered page runs its JS at
> speculation time. A guard with nothing to guard against is the quietest possible way for a
> feature to be missing.

> **RULE: a prerendered page runs its JavaScript at speculation time.** Any island that
> writes, measures time, or beacons **on mount** must be wrapped in `whenActivated()`
> (`lib/prerender.ts`), which defers it to the `prerenderingchange` event. A discarded
> prerender never activates, so the work never happens.
>
> `Track` and `ScrollDepth` are already wrapped: without it, one hover would record a
> pageview for a page nobody opened, and `ScrollDepth`'s dwell timer would count the
> speculation wait as reading time. Analytics rows are kept forever, so this class of bug
> is not self-correcting. Adding a new on-mount side effect? Wrap it.

## Verify (no browser needed)

- **Reader CSS/JS size:** `npm run build`, then read `.next/static/chunks/*.css` (public entry
  should carry zero `admin-canvas`/`ProseMirror`) and diff the post page's `<script>`/`<link>`
  set against the framework baseline.
- **What a reader loads:** `npm run start`, fetch a post, extract `<script src>` + `<link
  rel=stylesheet>`; confirm no admin chunk, no `next-auth` in the initial set, correct font
  preloads for the site language.
- **Critical path / LCP:** Lighthouse "Network dependency tree" — the chain should be HTML →
  public CSS → (at most) the reading font's language subset(s). No chrome font, no unused
  subset, no admin CSS.

## Rendering — the body cache and the warm

**Measured 2026-07-29, on the live box against a copy of the real database.** The design
assumed a re-render cost a fraction of a millisecond, which is why `clearCache()` throws
away every page on any write (Invariant 1) without a second thought. It does not:

| | |
|---|---|
| Cold article render | **92–383 ms** across the archive |
| An 85,000-character post | **364 ms**, of which `renderPostContent` is **359 ms** |
| Inside that, `marked.parse` | **360 ms** — marked itself, not our renderer or our options: a plain `Marked` with no configuration measures 375 ms on the same input |

So the rendered body is cached in `render_cache` alongside the highlighter, keyed by the
**build commit + the media facts + the markdown**. Nothing invalidates it: a change is a
different key. See `docs/spec/01-schema.md` §4 for why the argument against it was wrong.

Measured after, same box, same post: **383 ms → 1 ms** with the page cache cold and the
body cache warm, and the full 74-page warm sweep **3,948 ms → 203 ms**.

**Three rules for this cache:**

- **The build commit is in the key.** A deploy that changes any transform in
  `post-content.ts` must not serve yesterday's HTML out of a cache that cannot tell. A
  hand-maintained version constant would have been free and would eventually be forgotten.
- **It is never load-bearing.** A read that throws returns null and the page renders the
  slow way. Tested with the table dropped.
- **`clearCache()` does not touch it.** It is content-addressed; a stale row is inert.

### The warm, and the CDN purge

`clearCache()` carries a hook list, and `src/index.ts` registers a debounced
warm-then-purge (`server/warm.ts`). Warm FIRST, purge second, so the edge refetches into a
warm origin. It runs on boot too, which is what makes a deploy clear the edge without
anyone remembering to.

**The hooks are registered from the entry point, never from inside `clearCache()`.** A test
suite flushes several hundred times and must get a plain `Map.clear()`; a CLI must not be
left holding a timer open.

`purgeEdge()` (`server/edge-cache.ts`) uses `cloudflareApiToken` + `cloudflareZoneId` from
`integration_keys`. Those keys have been in the schema and in the Admin UI since the import
and **nothing in 2.0 ever read them** — the port dropped the call and kept the panel.
Measured through the CDN before writing any code, because a gap has to be real first:
`cf-cache-status: HIT`, `Age: 165` against `s-maxage=60, stale-while-revalidate=600`.
Unconfigured is a no-op, which is the normal state of a self-hosted install.

## Compression

`Bun.serve` sends exactly what a handler returns and nothing set `content-encoding`, so the
stylesheet, every page and every feed left the origin raw. `web/compress.ts` gzips text
responses over 1 KB when the client asked, and sets `Vary: Accept-Encoding`.

Measured at the origin: the public stylesheet **61,241 → 19,513 bytes**. A reader does not
see this directly — the CDN re-compresses on its way out — but the origin-to-edge fetch
does, on every cache miss and on every purge above. It is also what a reader gets if the
CDN is bypassed or removed.

Binary bodies are left alone: an image, a font or a WebP variant is already compressed and
gzipping it spends CPU to add bytes.
