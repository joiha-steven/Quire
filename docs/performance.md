> Split from CLAUDE.md — the **resource-loading law**: how fonts, CSS, and JS reach a
> reader. One rule set, applied system-wide (every language, every font preset, every
> uploaded font). Touching the root layout, `lib/themes.ts` font helpers, the stylesheet
> entries, or adding a client island? Read this first. The *why* is in
> [`ARCHITECTURE.md`](../ARCHITECTURE.md) "Resource loading".

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

Hard invariants (also in [`conventions.md`](./conventions.md) typography):
- **Self-hosted only.** No `next/font/google`, no build/runtime fetch to Google (broke
  offline/CI). Files in `public/fonts/`, subset `-latin` / `-latin-ext` / `-vietnamese`.
- **Never preload `latin-ext` or a specific weight.** Built-in reading fonts are variable
  (one file per subset carries every weight); `latin-ext` glyphs are rare and load on demand.
- **Never preload the chrome font**, in any config. (Regression to watch: a "no swap flash
  on chrome" instinct will try to re-add it — don't; chrome is not LCP.)
- Changing which subsets exist? Keep `fontPreloadHrefs` and the `@font-face`
  `unicode-range` blocks (`globals.css`) in sync.

## CSS — two entries; a reader never loads admin CSS

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
5. **The framework baseline** (react-dom + Next App Router, ~130 KB gzip) and the RSC flight
   payload are the floor; don't chase Lighthouse "legacy/unused JS" inside those vendor
   chunks — Turbopack doesn't strip them via `browserslist`, and they're not on the LCP path.

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
