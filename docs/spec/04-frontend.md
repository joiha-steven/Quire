# Frontend: CSS, islands, admin, editor

Replaces the Go plan's frontend spec. Two frontends with opposite budgets.

- **Public**: server-rendered HTML, no framework, no bundler, **zero JavaScript on an
  article page**.
- **Admin**: the existing React SPA, built once and embedded. Only the owner loads it, so
  its weight is irrelevant to readers and to SEO.

## Budgets (enforced by a CI check)

| Page | JS (brotli) | CSS (brotli) | Gate |
|---|---|---|---|
| Article page, initial | **target 0 KB** | target 8 KB | fail above 3 KB JS |
| Listing page, initial | target 2 KB | target 8 KB | fail above 5 KB JS |
| Admin SPA | around 400 KB | around 40 KB | informational only |

For reference, the current article page fetches **182 KB of JS (gzip)** across 12 files,
of which **143 KB is Next and React**. The islands were never the problem; the framework
underneath them was.

The Go plan set 15 KB as the failure line. Zero is achievable here and worth aiming at,
because every kilobyte on an article page is paid by a reader who did not ask for it.

## CSS: hand-written, no Tailwind on the public site

Currently one 63 KB (raw) Tailwind stylesheet covering public and admin.

**Public CSS is rewritten by hand**, roughly 1,000 lines, built on custom properties.
Reasons, in order:

1. **Ten-year durability.** A CSS framework is the highest-mortality dependency in the
   tree. Tailwind v3 to v4 already broke once. Hand-written CSS on web standards does not
   break, ever, by design.
2. **No build step.** The public site stops needing a bundler at all.
3. The theme system is **already** custom properties: `themesToCss` emits every palette's
   variables. Half the work is done.
4. Modern CSS covers what the framework was providing: nesting, `:has()`, container
   queries, cascade layers, `color-mix()`.

Tailwind is **kept for the admin SPA**, where its churn is contained behind a build that
only the owner's browser sees.

Delivery: `public.css` is small enough to **inline into the document head**, so an
article page makes zero blocking stylesheet requests. `book.css` stays route-specific and
lazy.

Conventions from `docs/conventions.md` carry over unchanged and are now easier to hold:
theme tokens only, one typeface, no hardcoded sizes, one divider style, no all-caps.

## Fonts: DONE 2026-07-27, 51 KB off the critical path

The Go plan called Literata a ~107 KB LCP bottleneck. Measured against production it is
**97,588 B** (`literata-latin` 80,660 + `literata-vietnamese` 16,928, because the site runs
Literata with `language: vi`), so the claim was substantially right.

Two of the three sub-items were already implemented before this plan existed:

| Sub-item | State |
|---|---|
| Subset per script | **Already done**, `-latin` / `-latin-ext` / `-vietnamese` |
| Preload only the LCP face | **Already done**, `fontPreloadHrefs` implements exactly this rule |
| Make the file smaller | **This is where the work was** |

The find was the `opsz` axis, which doubles the two book serifs: Literata carries 300
glyphs to Inter's 518 yet was 80 KB to Inter's 36 KB, all of it `gvar` deltas across the
optical range. Pinning it at 18 gives:

| | Before | After |
|---|---|---|
| `literata-latin` | 80,660 | **37,560** |
| `literata-vietnamese` | 16,928 | **8,652** |
| **Preload set** | **97,588** | **46,212** (−53%) |

Also 180 KB off the font directory overall, since Source Serif 4 gets the same treatment.

Reasoning, the rejected alternatives, and why 18 was chosen over 14/16/24 live in
`docs/performance.md` and `scripts/subset-font-axes.py`.

**Standing rules**, unchanged and already honoured:

- Subset per script. A Vietnamese reader must not download Cyrillic or Greek ranges.
- Preload **only** the single face that renders the LCP element, never the family.
- `font-display: swap` with a metric-matched fallback so the swap does not shift layout.
- Trim variation axes before shipping a font file (`scripts/subset-font-axes.py`).

## Perceived speed: two zero-JavaScript wins

**Speculation Rules.** Ten lines of JSON in the head; the browser prerenders the likely
next page on hover or viewport entry. The click then paints an already-rendered document.
This is the single largest perceived-speed improvement available to a blog and it costs
no runtime JavaScript.

```html
<script type="speculationrules">
{"prerender":[{"where":{"href_matches":"/*"},"eagerness":"moderate"}]}
</script>
```

Tune `eagerness` against real analytics; `moderate` (hover) is the safe default, and
`eager` wastes bandwidth on readers who scroll past everything.

**View Transitions.** Cross-document transitions via `@view-transition { navigation: auto }`
in CSS. Smooth navigation with no framework and no client router.

Both degrade to nothing on browsers that lack them.

## The 23 islands

Each current `'use client'` component in `src/components/blog/` and its replacement.
Three eagerly loaded files, none of them bundled, each hand-written and self-contained.

```
core.js       every page      Track, ScrollDepth, RailToggle, BackToTop, SearchTrigger
listing.js    listings        GridToggle, InfiniteListing
post.js       /{slug}         only if the CSS-only routes below fail their measurement

lazy, fetched on first use:
search.js     when the search overlay opens
comments.js   when comments scroll into view
subscribe.js  when the subscribe trigger is used
reader.js     when book mode is entered
turnstile     third party, only when a comment form is opened
```

| Component | Does | Replacement | Bundle |
|---|---|---|---|
**Shipped so far (2026-07-27):** `BackToTop`, `CodeCopy` and `Lightbox` as `post.js`
(2,966 b minified, one deferred request). `ReadingProgress` was deleted as planned and is
now CSS. The bundle names below are the plan; `core.js` arrives with the analytics beacon.

| `Track` | Pageview beacon | `navigator.sendBeacon` on load | core |
| `ScrollDepth` | Max depth + dwell on leave | scroll listener + `visibilitychange` beacon | core |
| `RailToggle` | Sidebar rail open/closed | click handler + `localStorage` | core |
| `BackToTop` | Scroll-to-top button | ~15 lines | post ✅ (moved out of core: nothing else in core exists yet) |
| `RevealFallback` | Reveal on scroll | **CSS `animation-timeline: view()`. Delete the JS** | none |
| `CodeCopy` | Copy button per code block | per-`<pre>` button + `navigator.clipboard`, ~20 lines | post ✅ |
| `Toc` | Highlights the active heading | `IntersectionObserver`, or CSS scroll-driven if it measures clean | post |
| `Lightbox` | Click an image to zoom | `<dialog>`, native backdrop and Esc | post ✅ |
| `ReadingProgress` | Progress bar | **CSS `animation-timeline: scroll()`. Delete the JS** | none ✅ |
| `BookMode` | Toggle into book mode | click handler that imports `reader.js` | core |
| `BookReader` | Fullscreen 2-column overlay | the heavy one, stays lazy, rewritten vanilla | lazy |
| `GridToggle` | List vs grid | class toggle + `localStorage` | listing |
| `InfiniteListing` | Infinite scroll | `IntersectionObserver` + fetch of the next page fragment | listing |
| `SearchTrigger` | Opens search | inline, imports `search.js` | core |
| `SearchOverlay` | Overlay shell | `<dialog>` | lazy |
| `SearchClient` | Queries and renders | fetch + template literals | lazy |
| `SubscribeTrigger` | Opens subscribe | inline | core |
| `SubscribeOverlay` | Overlay shell | `<dialog>` | lazy |
| `SubscribeForm` | Posts the email | plain `<form>` + fetch for the inline result | lazy |
| `Comments` | Renders the tree | **server-rendered HTML fragment**, fetched on demand | lazy |
| `CommentsLazy` | Defers the above | `IntersectionObserver` | lazy |
| `CommentForm` | Submits a comment | plain `<form>` POST, enhanced with fetch | lazy |
| `Turnstile` | Cloudflare widget | third-party script, with the comment form | lazy |

Note the pattern: several exist as separate components only because React forces a
component boundary for state. In vanilla, the Search trio is one file and so is the
Subscribe trio.

**The 0 KB target on an article page depends on `Toc`, `Lightbox` and `CodeCopy`.** If all
three land in CSS or in `core.js`, `post.js` does not need to exist. Decide during M2 with
a measurement, not an assumption.

## Comments rendered on the server

Today the tree is fetched as JSON and rebuilt by React. In Quire 2.0 the lazy fetch
returns **rendered HTML** and the client inserts it. This removes the client-side tree
rebuild, the orphan re-rooting and the tombstone logic from the browser, since all three
already exist on the server.

## Admin: the existing React SPA, embedded

**61 of 66 admin components are already `'use client'`.** The admin is a React SPA that
happens to be wrapped in Next. So it is extracted, not rewritten.

```
1. Move src/components/admin + src/app/admin  ->  v2/admin/
2. Replace the Next-isms:
     next/link       -> <a> or the router's Link      (29 sites, all files)
     next/navigation -> a small client router          (30 sites)
     next/dynamic    -> React.lazy                     (4 sites)
     next-auth/react -> the session endpoint in 06-auth.md
3. Build with Bun's bundler to admin.js + admin.css
4. Embed and serve from Hono at /admin/*
```

What this deletes from the Go plan: the Tiptap port to vanilla, the ProseMirror NodeView
rewrites for `CaptionedImage` and `VideoNode`, the toolbar and bubble-menu rewrite, and
the reimplementation of autosave, crash recovery, conflict detection and Vietnamese IME
handling. All of it keeps working because none of it is touched.

The editor features that must not regress are therefore not a risk register entry any
more; they are existing code:

- Autosave to `localStorage` immediately, server every 5 seconds when dirty
- Crash recovery offering a newer local draft
- Conflict detection warning instead of overwriting
- Revision history (SQLite makes rows cheap, so raising the limit past 3 is now a product
  decision, not a technical one)
- Vietnamese IME with Telex

**Analytics is the one admin area worth revisiting later.** `AnalyticsView.tsx` plus
`AnalyticsPageDetail.tsx` are about 13 KB of React producing charts that server-rendered
SVG would produce with no client JavaScript and less code. Not in scope for v2.0; noted
because it is the highest-value cleanup left in the admin.

## Building

- **Public JS: no bundler.** Three hand-written files with no dependencies and no imports
  between them, minified by `bun build --minify` as a one-liner, or shipped as-is. There
  is no module graph to manage.
- **Public CSS: no build.** One hand-written file, inlined at render.
- **Admin: `bun build`**, output committed or built in CI. The admin is the only part of
  the project with a build step, and that is the whole point of keeping it separate.
