> Split from CLAUDE.md — read when touching typography, header/menu alignment, layout/divider, i18n, scripts, or releases. Hard rules used everywhere stay in [`CLAUDE.md`](../CLAUDE.md); this file is the per-area detail.

# Conventions (detail)

## Localization — `src/locales/`

- `types.ts` = shapes (`Dict` public, `AdminStrings` admin). Add a key → every locale file
  must define it (`satisfies` → build error otherwise = the no-missing-keys guarantee).
- `langs.ts` = `SITE_LANGS` + `isSiteLang`. Public `src/locales/<code>.ts`, admin
  `src/locales/admin/<code>.ts`. Supported: **en (default), vi, de, ja, zh, ko** (CJK via
  `system-ui` fallback — Inter has no CJK glyphs).
- **Add a language:** extend `SiteLang`, add a `SITE_LANGS` row + a `DATE_LOCALE` entry in
  `i18n.ts` + both locale files.
- **Add/rename a string:** add to `types.ts`, then fill ALL locale files. Build fails until
  complete. **Keep every locale in sync on any UI string change.**

## Header (public) — alignment is a HARD RULE

- Logo + the icon row share ONE flex line (`items-center`) so icons stay on the logo's
  vertical midline; the description sits below.
- **The logo is auto-sized, never the raw original.** `settings.logoUrl` = the owner's
  untouched source; the header renders `settings.logoRenderUrl` (small WebP scaled to
  `logoWidth` @2x for retina, built on save by `renderLogo` in `files.ts`), falling back to
  the original only for vector/animated logos. The `<img>` carries `width`+`height`
  (`logoRenderHeight`) → no CLS. `saveSettings` regenerates on source/width change and deletes
  the old derived file (one ever exists). PageSpeed image-delivery fix.
- Icons are one set: 20px, viewBox 24, stroke 1.8, round caps.
- Theme default = **system** (no-FOUC script + `ThemeProvider` both `|| 'system'`); the toggle
  reflects the *applied* theme (`useSyncExternalStore` on `<html>.dark`; server snapshot =
  light → no hydration mismatch).
- Two orthogonal axes: **mode** (`.dark`) × **palette** (`data-palette`). `PaletteToggle` /
  `ThemeToggle` write localStorage + the attribute; the no-FOUC script applies before paint;
  all palettes' vars are emitted once. (Mechanism rationale → ARCHITECTURE.md.)

## Typography — one source of truth (HARD RULES)

- **No hardcoded text sizes on the public site.** 9 roles (`TypeRole`: `h1–h5`, `body`,
  `small`, `caption`, `code`), each with size/line-height/letter-spacing → CSS vars
  `--fs/--lh/--ls-<role>`. Defaults baked into `globals.css :root` and mirrored by
  `DEFAULT_TYPOGRAPHY` in `lib/themes.ts`. The owner's `settings.typography` is emitted by
  `typographyToCss()` into the root layout AFTER `globals.css` (also applies in the admin
  editor `.prose` = WYSIWYG). `smoothing` adds `-webkit-font-smoothing` on `body`.
- **Where applied:** `.prose` (h1–h5/pre/code/figcaption/table) read the role vars; titles/UI
  OUTSIDE `.prose` use `.fs-h1…fs-h5` + `.t-small` (every secondary text). H1 = single
  post/page titles + category/tag headings + draft preview; list cards (`PostCard`) = H2. Only
  fixed public sizes allowed: the brand wordmark + the 404 numeral.
- **Inter is self-hosted** (`public/fonts/inter-{latin,latin-ext,vietnamese}.woff2`,
  variable, declared via `@font-face` + `unicode-range` in `globals.css`; `--font-inter:'Inter'`
  there). **No `next/font/google`** — it fetched at build, which broke offline/CI builds. The OG
  route self-hosts the same Inter separately as `.woff` (Satori can't decode woff2). To update
  Inter, re-drop the woff2 files. The latin subset is `<link rel=preload>`-ed in the root layout.
- **ONE typeface for EVERYTHING — hard rule, no exceptions (incl. admin + OG).** No
  `font-family`, no `font-mono`, no second family; `.prose code` is `inherit`;
  **`grep -rE "font-mono" src` must be empty.** A custom font (`settings.customFont` =
  family + `faces[]` per weight 400/500/600/700, uploaded via `FontUpload` → `/api/files/font`,
  Blob `files/font-<weight>-<ms>`, store-relative) overrides `--font-sans` (Inter fallback) —
  one `@font-face` per weight because faux-bold is disabled (`font-synthesis-weight: none`).
  `/og` renders Inter + the custom font (`lib/og.ts` `?font=`). Empty = bundled Inter.
- **Admin chrome does NOT follow the reader's type settings** — it uses Tailwind's standard
  scale (a fixed design scale); only the admin editor `.prose` mirrors the reader. Don't wire
  admin chrome to `--fs-*`.
- Editor exposes H1–H5; `marked` renders `####`/`#####` → `h4`/`h5`.

## Chrome reuse, divider, colour (HARD RULES)

- **Repeated chrome shares ONE class constant — never hand-roll per element.** Sibling controls
  import the same string so they can't drift. Admin nav is a **collapsible left sidebar**
  (`AdminSidebar.tsx`): each item has an icon (`navIcons.tsx`) + label; a toggle collapses the rail
  to icon-only (persisted in localStorage; it publishes its width as `--admin-nav-w` so the fixed
  settings/editor save bars offset past it). Every item — nav links AND theme/palette/cache/sign-out
  controls — uses `headerActions.ts` `SIDEBAR_NAV` (active links add `SIDEBAR_NAV_ACTIVE`); on mobile
  it's a hamburger drawer (always icon+label). (`ADMIN_NAV` is the older horizontal variant.)
  Public header's 40px icon buttons → `ICON_BTN` (`ui/iconButton.ts`). Adding an item = reuse the
  constant, never copy a class list.
- **Header/menu alignment must be pixel-exact — the owner is very sensitive and it has drifted
  repeatedly.** Every header-row item (incl. the bigger brand wordmark) is an
  `inline-flex h-9 items-center` box; the row is `items-center`. NEVER align a bigger wordmark
  by `items-baseline` (the recurring bug); never leave an item without the `h-9` box. Verify the
  rendered result before shipping.
- **One divider style site-wide:** the global `<hr>` (50% width, left, faint). Never bespoke
  `border-t`/`border-b` as content dividers; never ALL-CAPS (no `uppercase`) in shipped UI.
- **Public UI colours come ONLY from theme tokens — never hardcode `neutral-*`/`white`/`black`
  or a hex.** Vars `--c-bg/text/heading/meta/link/rule` are utilities (`bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`). Every line/border + faint surface
  (code blocks, hovers, banners) uses `--c-rule`. Admin tooling may stay neutral.

## Scripts — `scripts/`

`node --env-file=.env.local scripts/<name>.mjs [--dry]` — idempotent.

- **`schema.sql`** — full Postgres schema (11 tables + indexes + `posts.search` tsvector +
  RLS + the analytics RPCs). Run ONCE on a fresh Supabase project. NOT run by the app;
  transcribed from the live schema — **keep it in sync when you change tables/RPCs.**
- **`migrate-to-supabase.mjs`** — one-off P1.5 migration (Blob `_index.json`+`.md` →
  Postgres). Already run; kept for recovery.
- **`scripts/legacy/` — pre-Supabase one-offs, do NOT run against the live site** (they operate
  on the retired Blob `_index.json`/`.md` model): `import-wordpress`, `convert-html-to-markdown`,
  `fix-import-captions`, `backfill-excerpts`, `rehost-images`, `rebuild-index`, `wipe-media`,
  `backfill-reading-time`, `list-posts-with-images`, `check-image-links`,
  `backfill-media-dimensions`, `remap-original-images`. Kept for recovery only; their deps
  (`gray-matter`/`turndown`/`turndown-plugin-gfm`/`fast-xml-parser`) are devDependencies.

## Docs & releases — keep current

On any behavior change, update the matching doc in the SAME change (Working principle #3):
- **CLAUDE.md** = rules / data-layer / caching / gotchas. **ARCHITECTURE.md** = overview
  + why. **CHANGELOG.md** = one entry per user-facing change. **CHECKLIST.md** = pre-deploy
  steps. **README.md** = setup + features. **ROADMAP.md** = direction.
- **README is the canonical install/usage doc — keep it current.** Its **two install paths**
  (1️⃣ do-it-yourself, 2️⃣ hand-to-an-AI-agent) + the **MCP "let an agent write & publish"** section
  + the **env-var table** must be updated in the SAME change whenever setup/deploy/env/auth/MCP/backup
  behavior changes (new/renamed env var, a new owner setup step, a changed redirect URI, etc.).
  Never let the README drift from how the app is actually installed and run.
- Keep personal/instance values (credentials, Vercel/Blob IDs, the live domain) OUT of tracked
  files — `.env.local` + Vercel only.
- **Audits** (`audit/`): a full review per `audit/README.md` → dated `audit/YYYY-MM-DD-<scope>.md`;
  read the latest first so a pass starts from the last clean line.
- **Versioning (owner's rule — do NOT auto-bump):** the version is **`1.0.x`** (was `0.9.x`; the
  owner cut **1.0.0** with the MCP + Trash release). Each change bumps the patch `x`
  (→ `1.0.999`), a running counter with no semver meaning. NEVER raise `1.0` → `1.1` or `→ 2.0`
  unless the owner asks. A code change bumps `x`; pure-docs may skip. On a bump, also update the
  **README title** version: `` # vibe**blog** `v1.0.x` `` (centered header, top of README).
- **Cutting a release:** `x` already current; `npm run build` + `npm run lint` exit 0; push `main`;
  `gh release create v1.0.<x> --title "v1.0.<x> - <tagline>" --notes "…"`.
