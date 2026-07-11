# CHANGELOG

## v1.4.3 — 2026-07-11 (the reading layout: sidebar rail, built-in fonts, nested ToC, SEO & dashboard)

Consolidates the whole 1.4.1–1.4.3 line into one entry: the sidebar rail + accent colour, four (then
five) layout toggles, built-in reading fonts + book-page text, the nested/scrolling table of contents,
SEO (canonical + breadcrumbs) and cache-clear-on-deploy, a fuller admin dashboard, and MCP `patch_post`.
Nothing here changes an existing install's hue or breaks its settings.

**Reading — nested table of contents.** When a post mixes heading levels (H2 + H3), the top-level (H2)
rows get a bigger dot marker and the child (H3) rows go smaller with no dot — a few big markers over
quieter children. A post that is all-H2 or all-H3 stays uniform, as before. A long ToC that outruns the
viewport now scrolls inside its own (sticky) box instead of pinning its tail off-screen, and the gutter
rail is 30px wider (210px) to wrap less — the breakpoint is unchanged, so 1280/1366 laptops still show it.

**Admin — a fuller Overview.** The dashboard gains an **SEO health** card (published count + how many
posts miss an excerpt or a cover image, each linking to Content), a **Traffic sources** card (top
referrers + countries over 30 days by distinct visitor), a **Clear cache** button and a **View site**
link in Quick actions, and the System panel's Backups row now shows the **last run** (or "never").

**SEO — canonical + breadcrumbs.** Every indexable page now emits a self-referencing
`<link rel="canonical">` (home, posts, pages, category/tag, and each `…/page/[n]`), and posts carry a
`BreadcrumbList` (Home → category → post) alongside the existing `BlogPosting`. `/page/1` (and
`/category|tag/<x>/page/1`) now 308-redirect to the base instead of serving a duplicate of page 1.
(Unknown URLs already return a `noindex` soft-404 — Next's documented streaming behaviour — so they
were never indexable; no change there.)

**Cache — deploy flush.** `GET /api/cron?purge=1` (same `CRON_SECRET` auth) forces a full
`revalidateEverything()` — Next paths + the whole Cloudflare zone — so a code deploy, which runs no
admin write, still clears the edge. Content saves and the "Clear all cache" button already purge the
zone when the CF token+zone are set.

**New — built-in fonts** (Admin → Appearance → Font). Four self-hosted families: Inter, Source
Sans 3, Literata, Source Serif 4. Each is subset per unicode-range, so a family downloads only when
chosen. Picking a font also loads its tuned text sizing (a serif runs small, wants a tighter
leading) into the editable roles, which the owner still owns. An uploaded custom font overrides the
chosen built-in. (Bookerly was requested but is Amazon-proprietary; Source Serif 4 stands in.)

The chosen font styles the reader's words — post body + title, list cards, comment body, and the
editor. System chrome (dates, reading-time, related posts, header, footer, sidebar, admin) stays
Inter by default; a `fontChromeInter` toggle (Admin → Appearance) extends the chosen font across the
whole interface when turned off.

**New — book-page reading** (Admin → Settings → Features, `bookText`). Optional typesetting for the
post body: a first-line indent on each paragraph and justified text on columns 600px and wider, for a
printed-page feel.

**Sidebar — reaches every listing and marks where you are.** It now shows on home pages 2+ and on
category and tag archives (not just home page 1); the category or tag you are viewing carries the
accent mark, like a post's table of contents. Its breakpoint dropped so common 1280/1366 laptops show
the rail in the gutter instead of only the drawer handle.

**Fix — editor shows every category and tag.** The category/tag picker capped its suggestions at 12,
so terms past the first dozen never appeared to click. It now offers them all (scrollable), and typing
filters the list by substring.

**MCP — `patch_post`.** A new tool that partially updates one post by slug: only the fields you pass
change, the body and everything else stay put. Lets an agent tweak just the title, tags, or category
without resending the whole post (`update_post` still does a full replace).

**Fix — no more empty-slug posts.** A title/slug made only of emoji or punctuation slugified to `''`,
and the empty-slug row was unreachable from the editor and Trash (couldn't be edited or deleted).
`savePost`/`savePage` now fall back to a timestamped slug, so every post/page keeps an editable identity.

**Fix — serif reading fonts sit lighter.** Literata and Source Serif 4 rendered a large body (19px) and
a very black 700 bold that out-weighed the 600 headings, so bold read like a second heading. Body drops
to 18px (Literata) / 18.4px (Source Serif); presets now carry `readingBold: 600` (`--reading-bold`) so
`.prose` bold stays emphasis beneath the headings. Sans faces are unchanged.

**New — the sidebar rail.** Categories + tags (home) and a post's table of contents now live in the
left gutter, sticky, ranged right against a hairline divider, their first line level with the
content's first line. The reading column stays exactly centred: the rail is absolutely placed and
never displaces it. Its breakpoint is computed from `contentWidth`, so a wider column keeps the rail
hidden for longer. Below that width the SAME markup becomes a slide-out drawer behind a small edge
handle (`RailHandle` toggles `<html data-rail>`; drawer, handle and scrim all react in CSS).

**New — `accent`, a 7th palette colour** (Admin → Appearance). One highlight, used identically
everywhere: the marker beside the rail row you are reading, and the underline under any link you
hover (`.link-accent`, plus `.prose a:hover`). Seeded from each palette's `link`, so Mono stays
monochrome and no existing site changes hue. Settings saved before this key migrate on read.

**New feature toggles** (Admin → Settings → Features), all default on: `sidebar`, `leadPost` (the
newest post on home page 1 takes the h1 role), `categoryLabel`, `deck` (the excerpt as a standfirst
under a post title). Title display sizes come from the h1/h2 type roles, never a hardcoded value.

**Fixed**
- The table of contents never marked the section you were reading. An `IntersectionObserver` over
  the headings goes blank mid-section — the heading has already scrolled past, so nothing intersects.
  It now tracks the last heading past the reading line, coalesced to one measurement per frame.
- The drawer handle jumped half its height down the screen on every tap: it centred itself with
  `transform: translateY(-50%)`, which the global press feedback (`button:active{transform:scale(.97)}`)
  overwrote. It centres with `translate` now.
- The rail rendered before the page heading, so every page's outline opened with the sidebar's `h2`
  ahead of the article's `h1`.

**Changed**
- The table of contents is no longer a bordered, shadowed panel pinned to the viewport edge; it is
  type in the rail. It now opens with the post title (click = back to top) and closes with the
  tags/categories/comments jump, so a post with no headings still gets a usable index.
- The global `<hr>` runs the full column width instead of a left-aligned 50% stub.
- No rule between list cards and none under a post title: whitespace separates them. The
  end-of-article rules (before tags / related / comments) stay.

## v1.4.0 — 2026-07-09 (WordPress import, ops hardening, deep-audit fixes)

Outcome of a full read-through audit (UI/UX, typography, logic/cache, security, self-host
readiness). No CRITICAL/HIGH security holes were found; the rest is new capability + fixes.

**New — WordPress import (Admin → Settings → Integrations)**
- Upload a WordPress export (`Tools → Export → All content`, a WXR `.xml`) and its posts + pages
  import as Markdown — no CLI, no credentials. HTML → Markdown (turndown + GFM), categories/tags/
  dates/status/excerpt preserved, figure captions folded into the image alt, `Uncategorized` dropped.
  New content is ADDED (slug collisions get a numeric suffix; nothing is overwritten); images keep
  their source URLs. `lib/wordpress-import.ts` (pure, tested) + `POST /api/import/wordpress` +
  `ImportFields`. Replaces the removed, broken legacy CLI script.

**Ops / self-host readiness**
- **`GET /api/health`** — liveness/readiness probe (Postgres reachable + local store writable, 200/503);
  wired as the Docker `app` healthcheck.
- **Boot-time env validation** — `src/instrumentation.ts` + `src/env.ts` fail fast with a readable list
  when a required var is missing (guarded off build + edge, so `next build` still needs no backend env).
- **DB migration runner** — `schema_migrations` ledger + `scripts/migrate.sh` (`npm run migrate`) apply
  pending `scripts/migrations/*.sql` idempotently on upgrade; a Docker one-shot `migrate` service runs
  it before the app. Fresh installs seed the ledger from `schema.sql`.
- **Community + CI** — `SECURITY.md`, `CONTRIBUTING.md`, issue/PR templates, and a CI workflow
  (`check:all` + `build`).

**Security hardening**
- Generous per-IP rate limits on the public endpoints (`lib/rate-limit.ts`): `/api/track` (240/min,
  silent drop), `/api/search` (60/min → 429), `/api/mcp/register` (5/min).
- `/api/mcp/register` now gated behind `mcpEnabled()` (503 when off) so a disabled server can't grow
  the `mcp_clients` table.
- `/api/cron` uses a constant-time bearer compare; its maintenance steps are isolated so a finalize
  failure no longer skips the backup, and backup failures are logged.
- Backup **restore aborts** if the pre-restore safety snapshot fails, instead of overwriting with no
  recovery point.

**Fixes**
- Sitemap no longer lists category/tag URLs that 404 (derived from public posts only).
- Admin palette label `scifi` was keyed on a stale `rose` in all 6 locales → every language fell back
  to English; fixed.
- Admin Media/File library dates were hardcoded Vietnamese in every language → now locale-aware.
- A just-saved post now re-purges once its deferred AVIF/WebP variants finish, so `<picture>` appears
  without waiting on the ~1h ISR window.

**UI / typography**
- **Sharp corners everywhere** — one global `border-radius: 0` reset (house style).
- Removed `tracking-tight` from public headings so the Admin letter-spacing control actually applies.
- Visible focus ring on the two public search inputs.

**Cleanup**
- Removed dead code (`blobOrigin` + its layout block, `deleteByUrl`, `countByPost`, `tokenLimit`, an
  unused `signIn`); deduped `escapeHtml`; excerpt now clamps by chars too.

> Note: the CI workflow file (`.github/workflows/ci.yml`) must be added by a push with the GitHub
> `workflow` OAuth scope — it ships in the repo tree but a scopeless token can't create it.

## v1.3.6 — 2026-07-04 (fix: Cloudflare integration card reflects the saved state at once)

- The Cloudflare cache card now `router.refresh()`es after a successful save, so the "· saved"
  placeholder hint updates immediately instead of only after a manual page reload.
- Operational note (self-host): after an `ALTER TABLE` on a live database, reload the PostgREST
  schema cache (restart the service or `NOTIFY pgrst, 'reload schema'`) — otherwise PostgREST keeps
  its old schema and silently ignores writes to the new columns.

## v1.3.5 — 2026-07-04 (Auto CDN purge: Cloudflare cache clears on every write)

- **Cloudflare cache auto-purge.** Enter a Cloudflare API token (Zone.Cache Purge permission) + Zone
  ID in Admin → Settings → Integrations; the app then purges the whole zone on every content change
  and on "Clear all cache", so an edit is live instantly with no manual purge. Best-effort and
  non-blocking (fires after the response via `after()`), a no-op when unconfigured. Credentials are
  server-only (the `integration_keys` table, env fallback `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ZONE_ID`),
  never sent to the client. New `lib/cdn.ts`, hooked into `lib/revalidate.ts` (the single write choke
  point `freshenData`), new `CloudflareFields` admin card + `POST /api/integrations/cloudflare`.
- DB: adds `cloudflare_api_token` + `cloudflare_zone_id` to `integration_keys` (idempotent upgrade in
  `scripts/schema.sql`).

## v1.3.0 — 2026-07-04 (Native self-host: drop Vercel + Supabase-cloud, local-filesystem storage)

Quire is now self-hosted only, in two deploy flavors: **native** (install PostgreSQL + PostgREST +
the app directly on a Linux server) and **Docker** (unchanged). Vercel hosting and Supabase-cloud are
no longer supported targets.

**Storage: local filesystem only**
- Removed the Vercel Blob storage driver and the `@vercel/blob` dependency; binaries always live on
  the local filesystem (`STORAGE_LOCAL_DIR`, served at `/uploads`). `blob.ts` is now a thin facade over
  `blob-local.ts` (lazy-loaded so `node:fs` stays off the client). Deleted the browser-direct-upload
  token routes (`/api/{media,files}/blob-token`) and the `STORAGE_DRIVER` / `NEXT_PUBLIC_STORAGE_DRIVER`
  switches — uploads always POST to the server (no 4.5MB cap).
- Image refs stay store-relative: `collapseBlob` strips the `/uploads` prefix, `expandBlob` re-adds it.

**Deploy**
- New native install guide (`docs/self-host-native.md`) + systemd / PostgREST config templates in
  `deploy/native/`. Removed `vercel.json`.
- `.env.example` is now the native template. `SUPABASE_URL` points at your own PostgREST endpoint with
  `POSTGREST_DIRECT=1`; the `supabase-js` client and `SUPABASE_*` env names stay because they speak the
  PostgREST protocol, not a Supabase cloud project.
- Admin System panel reports self-host facts (Self-hosted / PostgreSQL / Local filesystem); dropped the
  Vercel region/branch/commit rows and the Supabase/Blob dashboard links.
- Analytics + comments read the visitor country from the CDN/proxy edge header (`cf-ipcountry`).

**Migration**
- `scripts/legacy/blob-to-local.mjs` mirrors a legacy Vercel Blob store to the local filesystem
  (pathnames preserved, so store-relative content renders unchanged).
- Docs refreshed to the native-first model (README, ARCHITECTURE, CLAUDE, ROADMAP, CHECKLIST, docs/*).

## v1.2.6 — 2026-06-26 (Quire 1.2: rebrand, dashboard, deeper analytics, galleries, lightbox & reworked editor)
Consolidates the whole 1.2.0–1.2.6 line into one entry.

**Rebrand**
- Renamed the project to **Quire** (a.k.a. Quire Blog): brand, wordmark (`quire`**blog**), package
  name, Docker/Postgres/MCP identifiers, GitHub URLs and the Drive backup folder (`quire-backups`);
  the `vibeblog-private` creds repo keeps its name.

**Admin dashboard & analytics**
- **Overview is now a dashboard:** a Traffic card (30-day views + visitors with a sparkline +
  last-7-days), Most-viewed posts, and a Needs-attention card (draft count).
- **Deeper analytics:** period-over-period trend (▲/▼) on views + visitors, a new-vs-returning split,
  top pages as a labelled Page/Views/Visitors/Depth table, and top referrers + countries counted by
  **distinct visitor** (one person = 1, not page views; country shows a flag) + a CSV export of the
  daily series. Needs a one-time DB migration (`scripts/migrations/2026-06-25-analytics-deepening.sql`
  then `…-analytics-fix-visitor-counts.sql`); until applied those sections fall back / stay hidden.
- **Faster admin home:** dropped a per-post content scan (`findUnusedMedia`, hundreds of serial
  queries) from the dashboard — it stays an on-demand check on the Media page.

**Image galleries & lightbox**
- Mark images `#grid` (a toolbar **Gallery** button with a multi-select picker, or the per-image
  **Grid** toggle); consecutive ones render as a **smart CSS grid** whose column count adapts to the
  image count (2→2, 3→3, 4→2×2, 5–9→3, 10+→4; collapses to 2 on phones).
- Picking several gallery images inserts **all** of them in one transaction (was keeping only the
  last — each `setImage` replaced the prior selected node).
- The editor preview lays gallery images **side-by-side** like the published grid (via
  `.react-renderer:has(> figure.img-grid)`), distinct from full-width single images.
- **Lightbox:** clicking any post/page image opens a full-size overlay with prev/next, keyboard nav
  (←/→/Esc), a counter and the caption.

**Editor**
- **Offline local autosave** (`useLocalDraft.ts`): unsaved edits are stashed in `localStorage` every
  8s and never hit the server until Save/Publish — editing a *published* post can no longer push
  half-finished text live, and a dropped connection won't lose work. A "restore / discard" bar offers
  any recovered draft on return; `beforeunload` still warns.
- **Editable tables:** a contextual control row (add/remove column, add/remove row, delete table)
  appears when the cursor is inside a table; the header row + left column are shaded with the table's
  own `--c-rule` colour as a visual spine (left-column shade is CSS-only, never changes the Markdown).
- **Live toolbar + floating selection menu:** the editor sets `shouldRerenderOnTransaction` so the
  toolbar reacts to the cursor (active highlights, the table row); selecting text — or putting the
  cursor in a link — pops a compact bubble (bold / italic / underline / strike / code + link
  edit/remove) that follows light/dark mode. Menu UI lives in `EditorMenus.tsx`.
- Drag-dropped images insert at the drop point; existing links are editable (prefilled href,
  clear-to-remove); clearer toolbar labels (text for Table / list / quote / code / divider); the
  Markdown/Review toggle trails the buttons inline.
- **fix(toc):** a heading that slugifies to nothing (e.g. `## !!!`) no longer emits an invalid `id=""`.

## v1.1.9 — 2026-06-24 (Docker self-host: fix fresh-install file permissions)
- **fix(docker): media uploads + ISR cache now work on a fresh self-host install.** The image runs
  as the unprivileged `node` user (uid 1000), but two paths were root-owned and unwritable, so a
  clean `docker compose up` failed at runtime:
  - **ISR/prerender cache** — Next 16 writes its segment cache under `.next/server/app/*` (not just
    `.next/cache`); the Dockerfile only chowned `.next/cache`, so revalidation failed with `EACCES`.
    Now `chown`s the whole `/app/.next` tree.
  - **Uploaded binaries** — Docker creates the `./data/uploads` bind mount as root, shadowing the
    image's chown, so posting an image/file failed with `EACCES`. Added a one-shot `init-uploads`
    service that fixes ownership (uid 1000) before the app starts.
- **chore: keep the bundled Docker stack's `./data/` out of git and lint.** Added `/data/` to
  `.gitignore` and `data/**` to the ESLint ignores so a `docker compose up` (which writes
  root-owned Postgres data there) no longer dirties the tree or breaks `npm run lint`.
- **Admin dotted-grid starts cleanly from the top-left edge** — one full gap of clear space before the
  first dot (`background-position` `-1px -1px` → `7.5px 7.5px`), no more dot crammed into the corner.

## v1.1.7 — 2026-06-23
- **Admin dotted-grid background tuned.** ~30% denser dots (tile `22px` → `15px`); light dots a touch
  dimmer (`0.13` → `0.11`), dark dots a touch clearer (`0.11` → `0.12`).

## v1.1.6 — 2026-06-23
- **In-page ToC meta drops the comment count.** The label is just `Comments` (`Tags / Categories /
  Comments`), no number — the count lived on the ISR-cached page so it was always stale; the
  authoritative count is in `/admin/comments`.

## v1.1.5 — 2026-06-23
- **Admin Comments table reworked.** The content cell now clamps to two lines and click-toggles to
  the full comment (click again to collapse) — per row, so replies (flat rows) expand independently.
  The post-title cell wraps instead of truncating, so long rows are no longer cut off. The **From**
  (provider) column is replaced by an **IP** column showing the commenter IP with the ISO country
  code in parens (`1.2.3.4 (VN)`); pre-feature rows show `—`.
- **Comments now persist the commenter IP + country** (`author_ip` / `author_country`, new nullable
  columns) — captured at submit (country is best-effort from the Vercel edge, blank off-platform).
  Admin-only: NEVER included in the public comment tree.
- **fix: in-page ToC meta shows the comment count as `Comments (N)`** (was `N Comments`); still hidden
  entirely at 0 (`Tags / Categories / Comments`). The count is part of the ISR-cached post page, so it
  refreshes on the next revalidation (≤1h) or when the post is next edited — not instantly on a new comment.

## v1.1.4 — 2026-06-23
- **fix: the no-cloud Docker stack, hardened by a real end-to-end boot test.** Brought the full
  `docker compose` stack up and fixed three issues a build-only check missed:
  - **No more `--env-file` footgun.** The compose file no longer uses `${...}` interpolation, so a
    plain `docker compose up -d` (or any compose command) reads every value straight from
    `.env.docker` — previously, forgetting `--env-file` silently recreated PostgREST with a blank
    JWT secret and broke auth. `gen-keys.mjs` now emits `PGPASSWORD` + `PGRST_JWT_SECRET` (the names
    PostgREST/libpq read directly); the DB URI carries no password.
  - **ISR cache is writable.** The runner now `mkdir`s + `chown`s `/app/.next/cache` for the `node`
    user — the standalone image ships `.next/static` as root but never `.next/cache`, so the first
    request hit `EACCES` trying to write the incremental cache.
  - **No duplicate env keys.** `.env.docker.example` dropped its empty `POSTGRES_PASSWORD=` /
    secret placeholders, so `gen-keys.mjs >> .env.docker` appends exactly one of each.
  Verified live: `service_role` SELECT → 200 and INSERT → 201, `anon` write → 401, the app homepage
  renders through supabase-js → bundled PostgREST, and `docker compose` runs warning-free.

## v1.1.3 — 2026-06-23
- **feat: Docker self-host needs NO cloud — bundled Postgres + PostgREST.** The compose stack now
  ships its own database, so a self-hoster never signs up for Supabase. Because the app only ever
  uses Supabase's REST layer (no Supabase Auth/Realtime/Storage), the stack is just **Postgres +
  PostgREST** (2 light containers): supabase-js points at the local PostgREST and the **entire data
  layer stays byte-for-byte unchanged**. The only code change is 3 env-gated lines in `db.ts` —
  when `POSTGREST_DIRECT=1` it strips the `/rest/v1` path prefix so supabase-js reaches bare
  PostgREST (no proxy container). Postgres applies `scripts/schema.sql` + a role/grant bootstrap
  (`docker/initdb/`) on first boot; `scripts/docker/gen-keys.mjs` mints the DB password + JWT secret
  + `service_role` key. Text now lives in `./data/postgres`, binaries in `./data/uploads` — back up
  those two folders. Managed-DB users can still point `SUPABASE_URL` at a real Supabase and drop the
  `db`/`rest` services. **Vercel is unchanged** (no `POSTGREST_DIRECT` → hits Supabase as before).

## v1.1.2 — 2026-06-23
- **feat: Docker self-host, from the same codebase.** `src/lib/blob.ts` is now a storage facade
  with two drivers picked by `STORAGE_DRIVER`: `vercel-blob` (unchanged default) and `local`
  (filesystem). The local driver (`blob-local.ts`) writes binaries to a mounted volume and serves
  them at `/uploads` (`app/uploads/[...path]`). The browser upload path mirrors this via
  `NEXT_PUBLIC_STORAGE_DRIVER`: off Vercel the bytes are POSTed to a server route
  (`/api/media/upload`, `/api/files/attach`) instead of client-direct-to-store — a Node host has
  no 4.5 MB body cap. Ships `Dockerfile` + `docker-compose.yml` (app + an hourly cron sidecar that
  pings `/api/cron`) + `.env.docker.example`; `next.config` gains `output: 'standalone'`. The image
  builds with **no backend env** (the data layer already degrades to empty), so it stays portable.
  **The Vercel deploy is byte-for-byte unchanged** — it ignores the Dockerfile and keeps Vercel Blob.
- **feat: backup is storage-driver aware.** `backup.ts` reads each blob through the driver
  (`readBlob`) instead of self-fetching the public URL, so a snapshot works under the local driver
  too. Google Drive stays the only backup target.
- **chore: `check:no-direct-blob`** added to `check:all` — `@vercel/blob` may be imported only by
  `blob.ts` (and `@vercel/blob/client` only by the client-upload files), so a self-host build can't
  silently depend on the Vercel SDK.

## v1.1.1 — 2026-06-23 (stable)
- **First STABLE release since `v1.0.15`** (`v1.1.0-beta` was a prerelease, not a stable cut). Rolls
  up everything since v1.0.15:
  - **Reader comments** — manual/instant (no cache), optional Cloudflare Turnstile, Google/Facebook
    commenter login, admin-managed keys, and **optimistic posting** + a route loading skeleton.
  - **Admin overhaul** — shared UI kit, dotted canvas, 5-tab settings; the **activity log** now also
    records server errors.
  - **Reworked post ToC** — "Tiêu đề" header, in-page jumps, collapsible on every viewport.
  - **Editable footer** with a tiny bold/italic/underline/link markdown editor.
  - **Reading-optimized typography defaults** + read time now on every list post (backfill).
  - **Site-wide motion engine** — subtle, token-gated, one admin switch; respects reduced-motion.
  - **Palette refresh** — true-neutral Mono, **Sci-Fi** replaces Rosé; per-palette visibility.
  - **Hardening** — one-command `check:all` + seam tests, single-source `liveOnly` soft-delete,
    force-no-store admin reads, iOS notch progress-bar fix.
  - Detail in the dated entries below.
- **fix(type): removed `text-wrap: balance`/`pretty`.** Both re-broke whole lines and left too much
  empty space on the right (titles wrapped early; body looked under-set). Text now wraps normally,
  filling each line to the measure. Don't reintroduce them.

## 2026-06-23 (v1.1.0-beta — activity log: errors now recorded + flagged)
- **feat: the activity log now captures server errors.** `logError` (the central route catch
  handler) schedules `after(() => logActivityError("METHOD /path", message))`, writing an
  `error`-action entry (same `activity_log` table, gated by the same `features.activityLog` toggle,
  never throws). Unexpected failures are now visible in **Admin → Log**, rendered with a red badge.
  Only genuine errors land here — validation 400s use `fail()`, not `logError`. `v1.1.0-beta`.
- **fix: many list posts showed no read time.** List views use the stored `posts.reading_minutes`
  column (the body isn't fetched for lists), and imported posts had it `null`. Added
  `scripts/backfill-reading-time.mjs` (mirrors `lib/utils.ts` `readingMinutes`; `--dry`/`--all`,
  idempotent) and ran it — 44 posts backfilled, 0 remain null. App saves already set the column, so
  this is a one-off repair. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — palettes: true-neutral Mono, drop Rosé, add Sci-Fi)
- **fix(palette): Mono is now truly hueless.** The old values had a faint warm/blue cast (cream
  `bg`/`rule`, slightly blue `text`/`meta`), so the menu hover looked tinted. All pure gray now, and
  `rule` is a touch lighter so the hover reads as a soft, colourless gray.
- **change(palette): removed Rosé, added Sci-Fi** — a cool graphite surface with an electric-cyan
  accent (the deep blue-black + bright cyan dark mode is where it shines). Saved settings migrate
  cleanly: `sanitizeThemes`/`sanitizeEnabledPalettes` keep only known preset ids, so a stored `rose`
  is dropped and `scifi` seeded on next save. Names localized in all 6 languages. Still 6 palettes.

## 2026-06-23 (v1.1.0-beta — UI fixes: logo cursor, title wrapping, admin dots)
- **fix: the header logo/wordmark now shows the pointer (hand) cursor**, not the text caret
  (`cursor-pointer` on the brand link).
- **fix: titles no longer wrap too early.** Dropped `text-wrap: balance` on headings — it shortened
  lines and left a premature right rag on list-card titles. Body keeps `text-wrap: pretty`.
- **change: the admin dotted canvas is more visible** in both light and dark (dot opacity + size up).
- **feat(comments): a posted comment now appears instantly (optimistic).** It's rendered with the
  SAME `renderCommentMarkdown` the server uses — so there's no content drift — overlaid on the tree
  via the new, tested `lib/comment-tree.ts` `mergeOptimisticComments`, then the authoritative refetch
  replaces it and clears the overlay. A failed POST removes the optimistic comment and shows the
  error. (Supersedes the old "refetch only" note; the refetch is still the source of truth.) The
  composer + sign-in buttons moved to `CommentForm.tsx` to keep files focused.
- **feat: a themed loading skeleton for blog routes** (`(blog)/loading.tsx` + `.skeleton`) for
  instant feedback on navigation. The subtle pulse follows the motion engine (gated by `data-motion`
  + `prefers-reduced-motion`), so it degrades to a calm static placeholder; sized to roughly match a
  post so the swap to real content barely shifts. `v1.1.0-beta`.
- **feat: a site-wide motion engine for a calmer, more "app-like" feel.** ONE set of tokens
  (`--dur-fast/base/slow` + `--ease`) drives every transition/animation across the public site AND
  admin. A single switch gates all of it: `<html data-motion>` is server-rendered from a new
  `settings.motion.enabled` (default on; no flash, no client JS), and BOTH `data-motion="off"` and
  `prefers-reduced-motion` collapse every duration to `0s` — instant, no per-component branching.
  Toggle in **Admin → Appearance → Rendering**.
- **What moves (kept subtle):** eased hover/focus/colour changes + a tiny press-squash on buttons;
  cross-fade page navigations via Next `experimental.viewTransition` + `::view-transition-*(root)`
  CSS; a gentle scroll-reveal on list cards (`.reveal`). All use cheap `opacity`/`transform` only —
  **no CLS, no render-blocking, no added client bundle** — and degrade to instant/visible where
  unsupported (the reveal is guarded behind `@supports (animation-timeline)` + `data-motion='on'`).
- **chore:** the file-size guard now also exempts the `src/locales/` i18n dictionaries (cohesive
  DATA manifests, like the already-exempt `types.ts`) — adding UI strings no longer trips the cap.
  `v1.1.0-beta`.
- **feat: the site footer is now owner-editable.** New `settings.footer` holds limited inline
  markdown — **bold / italic / underline / link** only — rendered by `lib/inline-md.ts`
  (escape-first like `comment-md`: the whole string is escaped, so only the `<strong>/<em>/<u>/<a>`
  we inject can appear; link hrefs are protocol-checked, `javascript:`/`data:` fall back to plain
  text). `{year}` and `{title}` tokens expand at render. Authored in **Admin → Settings → Site**
  via `FooterField` (textarea + a B/I/U/Link toolbar that wraps the selection + a live preview).
  The public layout renders it in `<footer class="site-footer">`; default = the old "© {year}
  {title} · powered by Quire Blog" line. Pinned by `inline-md.test.ts` (render + link-safety + escape
  + length). i18n in all 6 admin locales. `v1.1.0-beta`.
- **change(typography): retuned the default type scale for long-form reading** (the Reset target).
  Restrained, monotonic heading scale (h1 2.0 → h5 1.0; h5 was 0.9, *below* body — fixed), body
  leading eased 1.75 → 1.7 for an even grey column, code 1.65 → 1.6, h2 1.4 → 1.5 for clearer
  hierarchy. ~66-char measure (`contentWidth` 672) kept — already in the 60–75 cpl comfort zone.
  Updated in BOTH `globals.css :root` and `DEFAULT_TYPOGRAPHY`; readers who customized keep theirs.
- **feat(typography): `text-wrap` polish.** Headings get `text-wrap: balance` (no lone short last
  line), `.prose p` gets `text-wrap: pretty` (better rag) — both progressive, ignored where unsupported.
- **refactor: removed the last hardcoded public text sizes.** Brand wordmark `text-lg` → `.fs-h4`;
  Theme/Palette toggle menu items `text-sm` → `.t-small`; `PostCard` excerpt `leading-relaxed` +
  inline `font-size` → new `.t-body` utility (body role outside `.prose`). Public size grep is now clean.

## 2026-06-23 (v1.1.0-beta — admin overhaul: dotted canvas, shared UI kit, 5-tab settings)
- **feat(admin): a shared UI kit ends the per-page drift.** New `components/admin/kit.tsx` is the
  ONE source for admin chrome — `Card` (canonical surface), `PageHeader` (the title block every
  screen reuses, replacing a copy-pasted `<h1>` on each page), `Tabs` (one component for the
  `underline` + `segment` styles), `StatCard`, `EmptyState`, and table tokens (`TableFrame`/`THEAD`/
  `TROW`). Cards were `rounded-2xl p-5` in Settings but `rounded-xl p-4` elsewhere; now uniform.
  Migrated Overview, Content dashboard, Comments, Trash, Analytics, Activity log + the Media page.
- **feat(admin): a dotted-grid canvas.** `<main>` carries `.admin-canvas` (globals.css) — a CSS
  radial-gradient dot grid, fixed faint neutral per light/dark mode; sidebar + cards float above it.
- **feat(admin): the Overview shows more.** Stat row adds **Comments** (next to Posts/Pages) and
  every tile links to its section; plus a **Quick actions** row and a **Recent activity** card
  (latest 6, gated by `features.activityLog`). The System panel moves to the bottom.
- **feat(admin): Settings regrouped into 5 task-based tabs** — **Site / Content / Appearance / SEO /
  Integrations** (was General / Appearance / Advanced) — so each tab holds 1–2 cards instead of
  cramming five. Still ONE form + ONE save. The Drive-connect redirect now lands on `integrations`.
- **change(admin): the collapse control moved to the top** next to the wordmark (a compact chrome
  button, not a nav row) so it's no longer mistaken for Sign out, which now sits alone under a divider.
- **change(admin): palette selection is frontend-only.** The admin chrome dropped its `PaletteToggle`
  (only light/dark remains); the Appearance tab still sets the site default + reader-switchable
  palettes, with an in-place note. i18n synced across all 6 admin locales. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — ToC panel: "Tiêu đề", combined jump, collapsible everywhere)
- **feat(blog): the post ToC is reworked.** Its title is now **"Tiêu đề"** (Headings) instead of
  "Mục lục"/"Contents" in all 6 locales, and **clicking the title scrolls back to the top**. Under
  the headings, **one line** joins the present **tags / categories / comments** labels and jumps to
  the first existing section (scroll-only, via a shared `TOC_ANCHORS` map + `scroll-mt-24` targets).
  The panel is now **collapsible on every viewport** from a **text-free left-edge handle** (the tab
  shape speaks for itself): default **open + pinned on desktop**, default **closed on mobile**
  (outside-tap / Escape dismiss). When a post has **no headings** the header is a plain,
  non-clickable **"Mục lục"** (`tocIndex`) and only the jump line shows; the panel disappears only
  when there is nothing at all to show. The **comments** label carries its **count in front**
  (e.g. "12 Bình luận", server-rendered). Solid `bg-bg` background so it never shows content
  through; clickable items now get a pointer cursor; phones gain wider side gutters
  (`px-8 sm:px-5`) so the handle clears the text. `v1.1.0-beta`.
- **fix(blog): the jump link pointed at `#undefined`.** `TOC_ANCHORS` was exported from the
  `'use client'` `Toc` module and imported into the Server Component post page; a Server Component
  importing a plain const from a client module gets a client-reference proxy, so `TOC_ANCHORS.tags`
  read as `undefined` on the server — rendering `href="#undefined"` and matching `id="undefined"`
  anchor targets (no build error, since the proxy doesn't throw). Moved `TOC_ANCHORS` to a plain
  `lib/toc.ts` that both sides import. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — comment integrations: setup help + links in the admin)
- **feat(admin): each comment integration now shows a one-line setup guide + a link.** Turnstile →
  Cloudflare dashboard; Facebook → Meta for Developers (create app, add Facebook Login, redirect
  `/api/auth/callback/facebook`); Google → a note that it reuses your sign-in and that **letting
  OUTSIDE readers in requires publishing the OAuth consent screen to "Production"** (in "Testing"
  only the owner can sign in), with a link to the Google Cloud consent screen. i18n in all 6 admin
  locales. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — comments: a too-deep reply is a clean 400, not a 500)
- **fix(comments): replying past the 3-tier limit (or to a missing parent) now returns 400, not
  500.** Found in a live end-to-end pass on manhhung.me — the depth guard worked but `addComment`
  threw a generic `Error` that fell through to the 500 handler. It now throws a typed
  `CommentInputError` the route maps to 400 with a clear message. Pinned by `comments.test.ts`
  (depth-limit / missing-parent / empty-body guards). `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — comment integration keys move into the admin)
- **feat: Turnstile + Facebook keys are entered in Admin → Settings, not env.** The optional comment
  integrations no longer need a Vercel redeploy to configure. Keys are SECRETS, kept in a new
  server-only `integration_keys` table (single row) — like `backup_state`, **never in
  `settings.data`** — set via an owner-gated `POST /api/comments/keys` (`CommentKeys.tsx`). Env vars
  of the same name still work as a fallback. **Google stays env-only** (it's the owner's admin
  sign-in — moving it to the admin would deadlock the owner's own login); its toggle just shows the
  "Sign in with Google" button, now clearly described as *letting outside readers sign in*.
- **refactor(auth): NextAuth config is a function so Facebook reads its keys from the DB at runtime;
  the edge middleware now reads the JWT via `getToken`** (new `lib/auth-shared.ts` holds the pure
  `isAuthorized`), so the Supabase client never enters the edge bundle. `getCommentEnv()` is now
  async (reads the key store). Behaviour-preserving for existing env-based setups. `schema.sql`
  updated; `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — reader comments, Phase C: Google/Facebook login)
- **feat(comments): readers can comment with a Google or Facebook account.** Toggles in
  Admin → Settings (each effective only when its env keys exist — "needs env key" badge). A
  signed-in commenter sees "Commenting as <name>" + a plain comment box: **no name/email fields and
  no Turnstile** — the server **trusts the session** (`getCommenter()`) for identity + provider.
  Logged-out readers still get the manual form **plus** sign-in buttons. Facebook is a new
  commenter-only NextAuth provider (`AUTH_FACEBOOK_ID/SECRET`); Google doubles as the owner's admin
  sign-in. The session now carries `name` + `provider` (`next-auth.d.ts` augmentation); the viewer is
  resolved client-side via `/api/auth/session` since the post page is static. **Signing in to comment
  does NOT grant admin** — `/admin` stays gated to `AUTHORIZED_EMAIL`. i18n: all 6 public + admin
  locales. This completes the 3-phase comment system. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — reader comments, Phase B: Cloudflare Turnstile)
- **feat(comments): optional Cloudflare Turnstile anti-spam for manual comments.** Toggle in
  Admin → Settings (under Comments). The manual form gates the comment box **behind a Turnstile
  pass** — the widget appears once name/email are filled, and only then does the message box show.
  The POST **verifies the token server-side** (siteverify, fail closed). Enforced **only when the
  toggle is on AND `TURNSTILE_SECRET_KEY` is set**, so turning it on without keys never locks out
  commenting — the admin row shows a "needs env key" badge (`getCommentEnv()` reports which
  integrations are wired; the public SITE key is passed to the widget, no secret leaves the server).
  New `lib/turnstile.ts` + `lib/comment-env.ts` + `components/blog/Turnstile.tsx`; env
  `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` (`.env.example` + README). `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — reader comments, Phase A: manual identity, instant, no cache)
- **feat: a text-only reader comment system, off by default (`settings.comments.enabled`).** Phase A
  of three (B = Cloudflare Turnstile, C = Google/Facebook login). What ships now:
  - **Public:** a comment block under each post — name + email + optional website, **limited markdown
    (bold/italic only)**, replies up to **3 tiers**, 1000-char cap. It's a CLIENT island that fetches
    `/api/comments` with `no-store`; the post page stays ISR, a new comment **shows instantly with no
    cache in the way and NO `revalidatePath`** (commenting never touches the ISR path).
  - **Admin → Comments:** every comment (content/post/time/name/from/delete); delete = soft delete →
    **Trash** (restore/purge in a new Comments tab). Settings → General has an **Enable comments**
    toggle. The posts table shows a **comment-count column** when enabled.
  - **Safety:** markdown is escape-first so no link/image/script/raw-HTML survives (Invariant 5);
    email is stored but NEVER sent to the public client; depth enforced server-side; published-post
    check + per-IP rate limit; `/api/comments` is the only public-exempt path, `[id]` DELETE stays
    owner-gated. New table `comments` (+ `schema.sql`). Tests: `comment-md`, `buildCommentTree`,
    `sanitizeComments`. `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — per-palette visibility; switcher hides when one is left)
- **feat(appearance): the owner can turn each color palette on/off for visitors.** New
  `settings.enabledPalettes` (allow-list of preset ids). Admin → Appearance shows a "Shown to
  visitors" checkbox per palette; the default palette is locked on so the set is never empty.
  The public + admin palette switcher lists only enabled palettes (`enabledPaletteOptions`), and
  **`PaletteToggle` renders nothing when ≤1 palette is enabled** — so a one-palette site has no
  theme-switch icon at all. The no-FOUC script ignores a stored palette that is no longer enabled
  (falls back to the default, no flash). Disabled palettes remain fully editable. Migration-safe:
  legacy settings with no `enabledPalettes` read as "all on" (`sanitizeEnabledPalettes`, pinned by
  `settings-sanitize.test.ts`). `v1.1.0-beta`.

## 2026-06-23 (v1.1.0-beta — soft-delete filter is enforced in one place)
- **refactor: `liveOnly()` (in `lib/db.ts`) is the single home of the soft-delete predicate.**
  Every live read of a soft-deletable table (posts/pages/media/files) now wraps its query in
  `liveOnly(...)` instead of hand-writing `.is('deleted_at', null)` at each of the 9 call sites —
  so the column + null check are defined ONCE and can't drift. Trash views still read the complement
  (`.not('deleted_at','is',null)`) directly. Behaviour-preserving; the `soft-delete.test.ts` suite
  (listing/public/search/single) guards it. First tagged **beta** of the 1.1 line. `v1.1.0-beta`.

## 2026-06-23 (v1.0.18 — verification is one command now, not a reading session)
- **build: `npm run check:all` is the Definition of Done** — typecheck + lint + four static
  invariant checks (`check:routes`, `check:filesize`, `check:no-any`, `check:token-bust`) + the
  vitest suite, all offline/no-creds. Codifies the manual greps that lived in `CHECKLIST.md` /
  `audit/README.md`. A separate `check:consistency:live` cross-checks the `media`/`files` rows
  against the real Blob store (skips cleanly without `.env.local`).
- **test: a minimal vitest seam suite (62 tests, <0.5s)** pinning the load-bearing invariants —
  blob collapse/expand round-trip, shared slug namespace, revalidate SUPERSET, markdown raw-HTML
  escaping + ToC anchor sync, and soft-delete (trashed content never leaks to a live read). Not
  broad coverage by design.
- **refactor: split two oversized modules under the 400-line cap (behaviour-preserving)** —
  `lib/media.ts` → `lib/image.ts` (pure sharp encoding) and `lib/settings.ts` →
  `lib/settings-sanitize.ts` (pure validation/migration); both one-way imports, all re-exports kept.
- **docs: CLAUDE.md restructured for debugging (504 → 199 lines)** — a per-area DEBUG ROUTER + a
  numbered Invariants list (each with its enforcing test/guard) up front; topic detail moved to
  `docs/{conventions,features,seo-pwa,mcp,backups}.md`, loaded on demand. No runtime change. `v1.0.18`.

## 2026-06-23 (v1.0.17 — admin live reads were silently served from the 1h Data Cache)
- **fix(admin): the MCP token list (and every admin live read) could show STALE data —
  most visibly "list token không hiện" after connecting a connector from Claude.** Root cause:
  `dynamic = 'force-dynamic'` does NOT de-cache our `db()` GET reads, because they opt into the
  Data Cache with an explicit `next: { revalidate, tags:['db'] }` — Next only auto-de-caches
  force-dynamic fetches that set NO revalidate (`noFetchConfigAndForceDynamic` in `patch-fetch`).
  So a tagged read stayed in the 1h Data Cache, and an OAuth token minted out-of-band (which
  intentionally does not purge tag `db`) never appeared. Added `export const fetchCache =
  'force-no-store'` — the lever that forces every fetch in a segment to `no-store` regardless of
  its options — to the `/admin` layout (cascades to all admin pages) and the owner-only live API
  routes (`api/mcp/tokens`, `api/files`, `api/media`, `api/media/unused`,
  `api/posts/[slug]/revisions`, `api/backup`). Public pages keep their cached/ISR reads (they set
  neither config). Same class of bug as the 1.0.11–1.0.13 "Backups stuck on Connect". `v1.0.17`.

## 2026-06-23 (v1.0.16 — reading progress bar reaches the top edge on notch/Dynamic Island)
- **fix(ios): the reading progress bar sat below the Dynamic Island / notch instead of at the
  true top edge.** Without `viewport-fit=cover`, iOS Safari lays the page out inside the safe area,
  so the bar's `top: 0` landed at the top of the *content* area (under the island), looking like it
  floated mid-screen. Set `viewportFit: 'cover'` in `generateViewport` so the page fills under the
  island and the fixed bar reaches the real top edge, and added `env(safe-area-inset-*)` padding on
  `body` so the header/content re-clear the island (env() is 0 on devices without insets, so no
  effect elsewhere). `v1.0.16`.
- **docs(readme): rewrote "What it is"** to lead with the actual pitch — open-source (MIT),
  built for people who just want to **write**, **fast load on mobile + desktop**, **readable
  typography**, and **easy to tweak from the admin with no hardcoded values**. Gave the feature
  table a real header row (`Area | What you get`) instead of the blank `&nbsp;` cells.
- **docs(readme): both "Get your own" paths now open by default** (the AI-agent path was
  collapsed and easy to miss). **The agent path now has the agent walk the owner through creating
  the Google OAuth "Web" client** (Cloud Console clicks, consent screen, redirect URI) and collect
  the client ID/secret back, instead of telling the owner to pre-create it alone. `v1.0.15`.

## 2026-06-22 (v1.0.14 — fix Backups card stuck on "Connect" after connecting)
- **fix(backup): the Backups card kept showing "Connect Google Drive" after a successful
  connect** (and "Back up now" stayed disabled). Root cause: the `backup_state` read is Data-Cache-
  eligible (tag `db`, 1h), and the connect write (`setDriveAuth`) didn't `revalidateTag('db')`, so
  `GET /api/backup` served the stale pre-connect "not connected" state until the cache expired.
  `setDriveAuth` / `clearDriveAuth` / `setFolderId` / `recordRun` now bust the `db` tag, so the
  admin reflects connect / disconnect / run / last-status immediately (confirmed via Supabase API
  logs: no `backup_state` re-read occurred after the connect writes). Also added a focus/visibility
  refetch to `BackupFields` so it re-syncs after the OAuth round-trip. `v1.0.14`.

## 2026-06-22 (v1.0.13 — fix Drive connect redirect + tidy Backups layout)
- **fix(backup): `redirect_uri_mismatch` connecting Google Drive.** The consent + token-exchange
  redirect URI was built from `req.nextUrl.origin`, which is a `*.vercel.app` host when the admin
  is reached there (sign-in still works because NextAuth uses `AUTH_URL`) — so it didn't match the
  one URI registered on the OAuth client. New `backupRedirectUri(settings)` derives it from the
  canonical `resolveSiteUrl(settings)` (e.g. `https://manhhung.me/api/backup/callback`), used by
  both `/api/backup/connect` and `/api/backup/callback`. Register that exact URI on the client.
- **ui(backup): the Backups card no longer spans full width.** It now sits in the same two-column
  Advanced grid as MCP + custom CSS, so the section reads evenly. `v1.0.13`.

## 2026-06-22 (v1.0.12 — slugified taxonomy URLs + clearer Overview)
- **fix(seo): category/tag URLs now use the slugified term**, e.g. `/category/suy-nghi` instead of
  `/category/Suy%20ngh%C4%A9`. New `lib/taxonomy.ts` (`termSlug`/`resolveTerm`); post-footer links +
  sitemap emit `termSlug(term)`; the four `category|tag/[slug]` routes resolve the slug back to the
  term (by `slugify` match) and `notFound()` on no match. **Old `%`-encoded URLs still resolve**
  (back-compat raw-term match) so nothing 404s. OG/metadata show the real term name.
- **feat(admin): Overview is clearer.** The media stat card now reads **Images** = original count,
  with a sub-line `N variants · M files` (variants = derived `-thumb`/`-1024`/`-1600` AVIF/WebP;
  files = `files/` blobs) instead of one opaque "Attachments" total. Category/Tag cards show their
  **total count** in the title. The System panel adds **MCP server** (on/off) and **Backups**
  (on when enabled + Drive connected) rows. New `stat*`/`sys*` locale keys in all 6 languages. `v1.0.12`.

## 2026-06-22 (v1.0.11 — full-site backups to Google Drive)
- **feat: full-site backup to the owner's Google Drive** (Admin → Settings → Advanced). One
  snapshot = a single self-contained `.tar.gz` — `db.json` (every text table) + `blob/<pathname>`
  (every binary) + `manifest.json`. Automatic on a schedule (cron, every `intervalDays`, default
  4) with retention (keep the newest `keep`, default 4), plus **Back up now / Restore / Delete**
  in the admin. New `lib/backup.ts` + `lib/gdrive.ts` + `lib/backup-state.ts`; routes
  `/api/backup` (status/run/delete), `/api/backup/restore`, `/api/backup/{connect,callback,disconnect}`.
  Cron (`/api/cron`) calls `maybeRunBackup()`.
- **Drive auth is separate from sign-in.** A dedicated `drive.file` OAuth consent (reuses the
  Google client; login scope untouched) stores a refresh token in the new **`backup_state`** table
  (single row). The token is a SECRET and is kept OUT of `settings.data` (which is sent to the
  client) — only non-secret config (`enabled`/`intervalDays`/`keep`) rides in `settings.backups`;
  status + the snapshot list come from owner-only `/api/backup` (never the token).
- **Restore** replaces every text table (settings upserted; others delete-all + insert with
  `id`/generated `search` stripped) and re-uploads every blob; a pre-restore snapshot is taken
  first. New `backups` activity actions; new `backup*` admin locale keys in all 6 languages; new
  `tar` dependency. Owner one-time setup: enable the Google Drive API + add the callback redirect
  URI to the OAuth client, then **Connect Google Drive**. `v1.0.11`.

## 2026-06-22 (v1.0.10 — hardening: edge guard, Google-only, MCP token expiry)
- **feat(security): `src/middleware.ts` edge owner-guard (defense-in-depth).** Reads the NextAuth
  JWT and blocks `/admin/:path*` (→ sign-in) and owner-only `/api/:path*` (→ 401) BEFORE the route
  runs — so a new admin page or API route is protected even if it forgets `requireOwner()`. Self-
  authed/public paths are allow-listed (`/api/auth`, `/api/cron`, `/api/track`, `/api/search`,
  `/api/mcp` except `/api/mcp/tokens`); add new public/bearer routes to `isPublicApi()`.
- **change(auth): Google is now the ONLY sign-in provider.** Dropped the GitHub OAuth provider
  (`auth.ts`, `.env.example`, README). `AUTH_GITHUB_ID/SECRET` are no longer read.
- **feat(security): MCP tokens now expire 180 days after creation.** New `mcp_tokens.expires_at`
  column (migration `mcp_tokens_add_expires_at`; default in `schema.sql`); `createToken` /
  `mintOAuthToken` set it on insert; `verifyTokenHash` rejects an expired bearer. The admin token
  table shows an **Expires** column (red "Expired" when past). Connectors silently re-authorize
  across the boundary; a manual token must be recreated. New locale keys `mcpColExpires` / `mcpExpired`
  in all 6 languages. The admin remains the sole authority over deletion. `v1.0.10`.

## 2026-06-22 (v1.0.9 — every error page shares one look)
- **refactor: all error/edge screens now route through ONE `ErrorScreen` component** so they can't
  drift. The public 404, the 5xx boundaries (`ErrorView`), and a new **admin 404**
  (`app/admin/not-found.tsx`, for unmatched admin URLs) all render the identical layout (number +
  title + text + actions on theme tokens) — fully consistent per request. Shared `ERROR_LINK` class.
- The public 404 keeps the blog header/footer; the admin 404 renders in the admin shell. (Other 4xx
  like 401/403 stay auth redirects/JSON by design, not pages.) `v1.0.9`.

## 2026-06-22 (v1.0.8 — fix stale admin lists + 5xx/error pages)
- **fix(admin): admin list endpoints showed STALE data (the real "can't delete a token" bug).**
  `db()` GET reads are Data-Cache-eligible (tag `db`, 1h). The admin client-fetched list routes
  weren't `force-dynamic`, so after a delete/upload the cached list still showed the old rows — the
  MCP token list kept showing a just-deleted token, so re-clicking Delete was a no-op on a dead id
  (only toggling MCP off, which calls `revalidateTag('db')`, refreshed it). Marked **`force-dynamic`**
  on every owner-only list route so they always read live: `mcp/tokens`, `files`, `media`,
  `media/unused`, `posts/[slug]/revisions`. Deleting a connection from the admin now takes effect
  immediately, as intended.
- **fix(admin): corrected `api/media` GET header comment** (said "public read" — it is owner-only).
- **feat: 5xx / error pages now match the 404.** Added `error.tsx` (per-segment) + `(blog)/error.tsx`
  (keeps the public shell) + `global-error.tsx` (root-layout failures), all rendering a shared
  `ErrorView` styled identically to the 404 (number + title + text + Try again / Back home, on theme
  tokens). New locale keys `errorTitle`/`errorText`/`tryAgain` in all 6 languages. `v1.0.8`.

## 2026-06-22 (v1.0.7 — MCP: admin is the sole authority over a connection)
- **change(mcp): OAuth tokens are NEVER auto-deleted.** Removed the rolling-window prune
  (`MAX_OAUTH_TOKENS`) — the system no longer removes connections behind the owner's back.
  Lifecycle rule now matches intent: a connection **persists forever** (eternal token, no expiry,
  no prune) until the **owner deletes it in the admin**; an admin delete is final unless the owner
  re-authorizes. Deleting the connector in Claude alone just lets it re-authorize (a new token row;
  the old one persists until the owner removes it). `v1.0.7`.

## 2026-06-22 (v1.0.6 — MCP token list always reflects reality)
- **fix(admin): the MCP token list no longer shows a stale snapshot.** It loaded only on mount, so
  connecting/disconnecting in Claude (out-of-band) left the admin list wrong — "can't delete the old
  one", "don't see the new one". It now **refetches on tab focus / visibility change** and has a
  manual **Refresh** button, so the owner always sees and can revoke every live token/connection.
- **fix(mcp): prune the OAuth rolling window by `id` (monotonic PK), not `created_at`** — removes a
  tie risk where a freshly minted token could be pruned. `v1.0.6`.
- Note: deleting a connector's token revokes that session; the connector can only re-appear if the
  owner re-approves OAuth (authorize is gated by the owner's login). To fully stop access, also
  disconnect in Claude or turn the MCP toggle off.

## 2026-06-22 (v1.0.5 — MCP: authorize once, connect forever)
- **fix(mcp): connecting an OAuth connector once now works indefinitely.** The `/token` exchange
  used to delete the previous "OAuth connector" token on every connect (single slot), so any
  reconnect or second client stranded an earlier session on a dead token → "connected but zero
  tools". Now `mintOAuthToken` **never pre-deletes** (the in-use token survives a re-auth) and keeps
  a small rolling window (`MAX_OAUTH_TOKENS`), so reconnects can't strand a client. Tokens stay
  eternal (no expiry), so claude.ai authorizes once and never has to re-auth.
- **fix(mcp): OAuth tokens are exempt from the manual 5-token cap.** Authorizing can no longer fail
  with "limit reached"; the admin create-token cap counts manual tokens only (`McpTokenInfo.oauth`).
- **docs:** corrected the stale `api/mcp/route.ts` header (it still described a single `MCP_TOKEN`
  bearer) and the CLAUDE.md MCP section. `v1.0.5`.

## 2026-06-22 (v1.0.4 — full-width admin + non-wrapping table headers)
- **feat(admin): admin pages now fill the browser width.** Dropped the `max-w-6xl` lock on the
  admin content column (no longer needed with the column/sidebar layout) — content is full width
  with ~100px gutters on desktop (`lg:px-[100px]`), tighter padding on mobile (`px-4`, `sm:px-6`).
  The fixed save bars (post/page editor, settings) align to the same gutters.
- **fix(admin): table column headers no longer wrap.** Added `whitespace-nowrap` to every admin
  table header row (posts, pages, trash, activity log); columns auto-size to content (auto table
  layout) instead of squeezing a header onto two lines.
- **polish(admin): mobile spacing.** Re-tuned the content gutters/top padding for phones alongside
  the width change. `v1.0.4`.

## 2026-06-22 (v1.0.3 — slim down: dead scripts + deps + comments)
- **chore: removed `@vercel/analytics`.** It duplicated the built-in cookieless analytics and
  shipped extra client JS; dropped the `<Analytics/>` tag + the package. The custom analytics
  (`analytics.ts`, Admin → Analytics) is unchanged.
- **chore: moved 12 pre-Supabase one-off scripts to `scripts/legacy/`** (kept for recovery, not
  deleted). Their parser deps (`gray-matter` → devDeps, `turndown`/`turndown-plugin-gfm`/
  `fast-xml-parser` already dev) no longer sit in production `dependencies`.
- **docs: trimmed verbose comments** across the data layer (`media`/`files`/`posts`/`settings`/
  `blob`/`themes`/`revalidate`) + `layout.tsx` / `PostContent.tsx` to terse, AI-readable notes —
  GOTCHAs and the "why" behind non-obvious decisions kept. No behavior change. `v1.0.3`.

## 2026-06-22 (v1.0.2 — collapsible sidebar + admin polish)
- **feat(admin): the sidebar is now collapsible and icon-led.** Each nav item has an icon
  (`navIcons.tsx`); the rail is narrower (`w-52`, was `w-60`) and a toggle collapses it to
  icon-only (`w-16`), persisted in localStorage and remembered across navigation. Collapsed items
  show a tooltip; the footer controls switch to icon-only too. The fixed settings/editor save bars
  follow the rail via a `--admin-nav-w` CSS variable (no hardcoded offset). All monochrome — no
  hardcoded accent colors/fonts/text sizes, per the project rules.
- **polish(admin): softer cards + a mobile-safe analytics grid.** Added a subtle `shadow-sm` to the
  admin card containers (lifts white cards off the gray canvas, matching the reference) and made the
  Analytics summary cards stack on phones (`grid-cols-1 sm:grid-cols-3`) instead of cramming three
  across. `v1.0.2`.

## 2026-06-22 (v1.0.1 — admin-managed MCP + left sidebar)
- **feat(mcp): MCP is now toggled + tokenized from the admin.** Replaced the single `MCP_TOKEN`
  env var with an Admin → Settings → Advanced panel: an **enable toggle** (`settings.mcp.enabled`)
  and an **access-token manager** — generate up to **5 named tokens**, each shown **once** on
  creation (only its SHA-256 hash is stored in a new `mcp_tokens` table), with last-used time and
  one-click revoke. `verifyMcpToken` now checks the bearer's hash against live tokens while the
  toggle is on. The OAuth `/token` exchange mints a managed token (named "OAuth connector",
  refreshed per connect) instead of returning a static secret. New owner-only
  `/api/mcp/tokens` (+ `/[id]`) routes; activity actions `mcp.token.create|delete`.
- **feat(admin): left vertical sidebar nav.** The admin top bar grew too crowded, so navigation
  moved to a sticky left sidebar (brand → links → theme/palette/cache/sign-out pinned at the
  bottom), with active-route highlighting; it collapses to a hamburger drawer on mobile. New
  `AdminSidebar` (replaces `AdminHeader`); shared `SIDEBAR_NAV` constant keeps every item uniform.
- **change(settings): "Text rendering" moved from Advanced → Appearance.** Font smoothing now sits
  with the other appearance controls; Advanced holds the MCP panel + custom CSS. `v1.0.1`.

## 2026-06-22 (v1.0.0 — MCP server + Trash)
First stable release: the blog can now be operated by an AI agent over MCP, and every
delete is recoverable via a Trash.

### MCP server
- **feat(mcp): remote MCP endpoint at `/api/mcp` (Streamable HTTP).** An MCP client (Claude,
  ChatGPT, …) can operate the blog through the SAME data layer as the admin UI — tools to
  list/get/create/update/delete(→Trash)/restore posts and pages, manage media + files (incl.
  `add_media_from_url`), read taxonomy, and read settings. Content is Markdown verbatim (no
  conversion). Tools live in `src/lib/mcp`; built on `mcp-handler` + `@modelcontextprotocol/sdk`.
- **feat(mcp): one full-access token + a thin OAuth layer.** Auth is a single bearer
  `MCP_TOKEN` ("one token, full power"); connectors that require OAuth obtain it via a minimal
  OAuth 2.1 flow (authorization-code + PKCE) gated by the owner's existing NextAuth login —
  `/api/mcp/{authorize,token,register}` + `/.well-known/oauth-{protected-resource,authorization-server}`.
  Unset `MCP_TOKEN` disables the endpoint entirely.
- **feat(mcp): sensitive settings are blocked.** `get_settings` reads everything, but
  `update_settings` exposes only a safe allowlist (title / description / showDescription) — theme,
  fonts, typography, menu, domain, SEO, language and logos cannot be changed over MCP.

### Trash / soft delete
- **feat(trash): every delete is now a soft delete to a recoverable Trash.** Posts, pages, media
  and files gain a nullable `deleted_at` column (NULL = live, timestamp = trashed). Deleting from
  anywhere (admin tables, media/file libraries, multi-select, "delete all unused") now MOVES the
  item to Trash instead of destroying it — every live read filters `deleted_at is null`, so trashed
  items vanish from the site, lists, search, sitemap/feed/llms and the libraries. Media/file soft
  delete KEEPS the blob, so a published post that links a trashed image keeps rendering; nothing is
  removed from Blob until an explicit purge. A trashed row keeps its slug (still reserved) so
  restore always works.
- **feat(trash): new Admin → Trash page (`/admin/trash`).** Four tabs (Posts / Pages / Media /
  Files), each its own list with **Restore** + **Delete permanently**, plus **Empty trash** per
  tab. Nothing auto-purges — permanent removal is manual only. New unified `POST /api/trash`
  (`{ kind, action: restore|purge|empty, ids? }`), owner-gated; restores revalidate the item's
  surfaces, media/file purges revalidate everything (blobs removed). New activity actions
  (`*.restore` / `*.purge` / `trash.empty`). i18n synced across all 6 locales. `v1.0.0`.

## 2026-06-22 (fix: duplicate favicon)
- **fix(favicon): emit exactly one `<link rel="icon">`.** Next auto-injects a `<link>` for
  `app/favicon.ico` **in addition to** the metadata `icons.icon`, so the page shipped two
  conflicting favicons (the bundled `vb` default declaring `sizes="256x256"` + the owner's custom
  one) and browsers often picked the wrong/bundled one — the custom favicon looked like it wasn't
  loading. Moved the default to `public/favicon.ico` (no auto-inject) and drive the icon solely via
  `generateMetadata` (`settings.faviconUrl || '/favicon.ico'`). `v0.9.29`.

## 2026-06-22 (audit fixes: self-hosted font, link hardening)
- **fix(build): self-host Inter — no more Google Fonts dependency.** Replaced `next/font/google`
  (which fetched Inter at build → broke offline / restricted-CI / Google-outage builds) with
  self-hosted variable woff2 (`public/fonts/`, subsetted by `unicode-range` in `globals.css`). The
  OG image already self-hosts the same Inter as `.woff`, so the whole app is now Google-free; one
  typeface everywhere, fully local. The latin subset is preloaded.
- **fix(security): sanitize link hrefs.** `PostContent` now drops `javascript:`/`data:`/`vbscript:`
  link schemes (marked v5+ stopped sanitizing) — `[x](javascript:…)` no longer renders an
  executable href. Raw HTML was already escaped, so this closes the remaining vector.
- **fix(toc): de-dupe heading ids.** Two identical headings used to emit the same `id` (broken ToC
  anchors); now 2nd → `foo-2`, 3rd → `foo-3`, with `PostContent` and `extractHeadings` sharing the
  counter so anchors line up.
- **fix(auth): normalize the owner email** (trim + lowercase both sides) so a provider returning a
  different case / stray whitespace can't lock the owner out.
- **fix(images): parse image-placement fragments as exact tokens** (`#left`/`#right`/`#wide`/
  `#left-wide`) so a stray fragment like `#bright` no longer matches `right`.
- **chore: add `typecheck` script** (`tsc --noEmit`). `v0.9.28`.

## 2026-06-22 (docs: slim CLAUDE.md)
- **docs(claude): CLAUDE.md 560 → 358 lines (−36%) with zero rules lost.** Deduped the "why"
  (delegated to ARCHITECTURE.md via a header note), deleted the standalone Portability section
  (its rule lives in Blob; rationale in ARCHITECTURE), compressed the data-layer table + the
  descriptive sections (SEO/Editor/Settings/PWA/etc.) to essentials, and collapsed the legacy
  scripts table to a one-line list. Every HARD RULE and GOTCHA kept verbatim (caching DO-NOTs,
  header `h-9`/no-`items-baseline`, one-font + grep checks, `hr{margin:0}`, i18n sync, versioning).
- **docs(claude): fixed a stale contradiction** — removed the dangling "`blob.ts` readJson/readText
  return fallback" line; those were already removed in P1.5 (the doc said so two sections earlier).

## 2026-06-22 (docs: DB schema + working principles)
- **docs(setup): added `scripts/schema.sql`** — the full Postgres schema (all 9 tables,
  indexes, the `posts.search` generated tsvector, RLS, and the `analytics_summary`/
  `analytics_totals` RPCs), transcribed from the live database. Self-hosters can now create
  the whole DB in one run; previously the repo had no schema at all (the migration script
  assumed the tables existed). Idempotent.
- **docs(readme): rewrote the install guide** — a step-by-step **Local setup** (prerequisites,
  clone → run `schema.sql` → Supabase keys → Blob token → OAuth app → env → run) and added the
  missing **Supabase / `schema.sql`** step to both Vercel deploy paths (manual + AI agent).
- **docs(claude): added a "Working principles" section** (think-before-coding, simplicity,
  surgical changes, goal-driven verification) at the top of CLAUDE.md, adapted to this repo —
  notably that verification = `npm run build` + `npm run lint` (no test suite). Pure docs — no
  version bump.

## 2026-06-22 (auto-sized header logo)
- **feat(logo): the header logo is auto-compressed to the chosen size.** The owner's picked logo
  (`logoUrl`) is ALWAYS kept untouched; on every settings save we (re)build one small WebP scaled to
  the header width at **2x for retina** (`renderLogo` in `lib/files.ts`, via sharp, never upscaled
  past the source) and serve THAT in the header (`logoRenderUrl`). The previous derived file is
  deleted each regeneration, so exactly one ever lives on the store (under `files/logo-*.webp`, hidden
  from every grid). Regenerates only when the source or `logoWidth` changes (or none exists yet);
  cleared when the logo is removed/hidden. Vector (svg) / animated (gif) logos are served as-is (no
  derived file). Cuts the header image payload from the full-size original to a few KB — the main
  PageSpeed "image delivery" win.
- **fix(cls): the logo now reserves its space.** The `<img>` carries `width`+`height` (`logoRenderHeight`
  = displayed height at `logoWidth`), so the header no longer shifts as the logo loads. `v0.9.27`.

## 2026-06-22 (one-font rule — absolute, no exceptions)
- **change(typography): one typeface for EVERYTHING, hard rule.** Removed the last monospace
  spots in admin (hex inputs, raw-Markdown source editor, code-token button, activity badge) — the
  whole app, public and admin, now renders in the single site font (`--font-sans`); `grep font-mono
  src` is empty.
- **feat(og): the OG image follows the custom font too.** When the owner uploads a font, `lib/og.ts`
  appends `?font=<blobUrl>` and the `/og` route renders the card in it (Blob host only, SSRF-guarded;
  Inter stays the glyph fallback). With no custom font it stays Inter — so the share image always
  matches the site's one font.
- **docs:** recorded the rule (one font + zero hardcoded font/size, everywhere incl. admin + OG; a
  custom font governs the whole site) in CLAUDE.md conventions + the Typography/OG sections. `v0.9.26`.

## 2026-06-22 (type scale re-tuned + one font everywhere)
- **change(typography): smaller, calmer default scale.** List-card titles (H2) were reading as
  banners — the whole scale was re-tuned down to a restrained ~1.18 ratio off an 18px body:
  `h1 1.95 / h2 1.4 / h3 1.2 / h4 1.15 / h5 0.9 rem` (was `2.26 / 1.74 / 1.45 / 1.24 / 0.9`),
  with line-heights/letter-spacing balanced per role for long-form reading. Reset restores these.
- **change(typography): one typeface for everything.** Code blocks + inline code now reuse the
  site font (Inter or the uploaded face) instead of a separate monospace stack — no font family
  is ever auto-added on the reading site. (Admin keeps functional monospace for the hex inputs +
  raw-Markdown source editor, a deliberate tool affordance.)
- **chore(typography): full site sweep, no stray hardcoded sizes.** Search inputs now use the
  `.fs-h2`/`.fs-h3` roles; the only remaining fixed public sizes are the brand wordmark and the
  404 numeral (deliberate display). Admin's arbitrary `text-[10px]/[11px]` badges normalized to
  `text-xs`; admin chrome otherwise stays on Tailwind's standard scale by design (it must NOT
  resize when the owner tunes the reader's content sizes). `v0.9.25`.

## 2026-06-21 (full per-role typography + per-weight fonts)
- **feat(typography): every text role fully tunable, zero hardcoded sizes.** Nine roles —
  h1–h5, body, small (dates/meta/related/ToC/pagination/search), caption, code — each with its
  own **size / line-height / letter-spacing**, emitted as CSS vars (`--fs-*`, `--lh-*`, `--ls-*`).
  All public reading + secondary text now maps to a role (new `.t-small` utility replaced every
  `text-sm`); only brand wordmark, search box, and the 404 numeral stay as deliberate one-offs.
  Defaults are tuned to read well; reset restores them exactly.
- **feat(typography): custom font per weight.** Four upload slots (Regular 400 / Medium 500 /
  SemiBold 600 / Bold 700) sharing one family — one `@font-face` per weight, so headings/bold are
  crisp (the site disables faux-bold). `POST /api/files/font` takes a `weight`; `settings.customFont`
  is now `{ family, faces[] }`. Old single-file shape migrates to the 400 slot.
- **change(admin): Settings tabs finalized** — Appearance holds colors + font (4 slots) + the
  per-role text-size table; Advanced holds the font-smoothing toggle + custom CSS. `v0.9.24`.

## 2026-06-21 (fonts + typography controls + settings tabs)
- **feat(typography): custom font upload.** Admin → Settings → Appearance can upload a typeface
  (`.woff2/.woff/.ttf/.otf`); it's stored on Blob under `files/` (separate from the media grid),
  registered via `@font-face`, and applied site-wide (`--font-sans`, Inter stays the fallback).
  `POST /api/files/font` → `{ url, family }`; `settings.customFont`. Remove restores Inter.
- **feat(typography): body size + reading rhythm + smoothing.** The scale now also covers normal
  body text (`--fs-base`); new controls for **line spacing** (`--lh-body`), **letter spacing**
  (`--ls-body`), and a **font-smoothing (anti-alias)** toggle. Stored in `settings.typography`,
  injected as a `:root` override; each group has its own reset-to-default.
- **change(admin): Settings split into 3 tabs** — General, Appearance, Advanced. Colors + font +
  text sizes live under Appearance; spacing/smoothing + custom CSS under Advanced. `v0.9.23`.

## 2026-06-21 (typography follow-up)
- **change(typography): list cards use H2, not H1.** Single post/page titles (and category/tag
  list-page headings) stay H1; post titles inside listings step down to H2 so the listing reads
  calmer. `v0.9.22`.

## 2026-06-21 (typography scale)
- **feat(typography): one site-wide heading scale (H1–H5), no hardcoded sizes.** Heading
  sizes now flow from five CSS variables (`--fs-h1`…`--fs-h5`) instead of per-element
  `text-[…]` values. Defaults follow the owner's spec — H1 ≈ 30% larger than H2, H2 20%
  larger than before (and 20% larger than H3), H4 10% larger than body text, H5 20% smaller
  (body = 1.125rem): `2.26 / 1.74 / 1.45 / 1.24 / 0.9 rem`. **Every title** (single post,
  single page, list cards, category/tag list pages, draft preview) uses **H1**.
- **feat(editor): H4 + H5 buttons** in the post/page editor toolbar (alongside H1–H3); the
  public renderer + `.prose` now style `h4`/`h5`.
- **feat(settings): "Heading sizes" card** (Admin → Settings) to customize each level (rem)
  with a live preview and a **reset-to-default** button. Stored in `settings.typography`,
  injected as a `:root` override after `globals.css`. `v0.9.21`.

## 2026-06-21 (uploads)
- **fix(media/files): browser-direct uploads — large files no longer fail.** Images and
  attachments now upload straight from the browser to Vercel Blob (`/api/media/blob-token` +
  `/api/media/register`, `/api/files/blob-token` + `/api/files/register`), bypassing the
  serverless **4.5MB request-body limit** that was silently dropping bigger files. The metadata
  is registered server-side (dimensions + thumbnail fetched back for images), the new item
  appears in the grid/list immediately (no refresh), and success/failure is always reported.
  Removed the old `POST /api/media/upload` and `POST /api/files`. `v0.9.20`.

## 2026-06-21 (analytics follow-up)
- **feat(analytics): scroll-depth / average read %.** A `<ScrollDepth/>` beacon on posts sends
  the max % of the page reached on leave (`analytics_scroll` table); the dashboard shows an
  overall "avg. read depth" and a per-page % in Top pages. `v0.9.19`.
- **feat(analytics): 24-hour range (hourly buckets).** New 24h option before 7d; the chart
  buckets by hour for it (day otherwise), via a `bucket` arg on `analytics_summary`. `v0.9.19`.
- **feat(admin): View column on the content tables.** Posts and Pages now show all-time total
  views per item (`analytics_totals` RPC → `getViewTotals`). `v0.9.19`.
- **change(analytics): keep events forever.** Dropped the 1-year cron purge — the full history
  is retained. `v0.9.19`.
- **change(admin): Analytics moved next to the home tab** in the admin nav. `v0.9.19`.

## 2026-06-21 (admin + analytics batch)
- **feat(analytics): self-hosted, cookieless page-view analytics.** New Postgres
  `analytics_events` table + `analytics_summary` RPC, a fire-and-forget `<Track/>` beacon
  (`POST /api/track`, runs after the response, never makes a page dynamic), and an
  **Admin → Analytics** page: total views, unique visitors, a daily bar series, and top
  pages over 7d / 30d / 1y. Visitors are counted by a salted IP+user-agent hash — no
  cookies, no PII stored; bots and admin/api paths are dropped. The hourly cron purges
  events older than a year. `v0.9.18`.
- **feat(admin): multi-select delete in the library.** Checkboxes + "Delete selected" on
  both the Images grid and the Files list (atomic batch delete; new `deleteFilesBatch` +
  `POST /api/files/delete`). `v0.9.18`.
- **feat(admin): Files tab lists the site icons.** The favicon / app icon uploaded in
  Settings now appear in a read-only group (tagged "Settings", `getSiteIcons` +
  `GET /api/files/icons`). An intro under the Library title explains image versions vs
  files-as-is. `v0.9.18`.
- **feat(admin): richer System panel.** The Overview system card now shows the live URL,
  branch, framework + Node runtime, and deep-links to the Vercel dashboard, Blob stores,
  the Supabase project, and the GitHub commit. `v0.9.18`.
- **feat(public): search opens in an overlay.** The header search icon opens a modal
  search-in-place (instant local title/tag + debounced body FTS) instead of navigating to
  `/search` (which still exists for deep links / no-JS). New `GET /api/search/index` serves
  the lean index. `v0.9.18`.

## 2026-06-21 (later)
- **style(post): match the single-post title to the list card title.** The `/[slug]` post
  heading now uses the same size + weight as the home/list card title (`text-[1.35rem]
  font-semibold`) so a post reads consistently from the listing into the article. `v0.9.17`.

## 2026-06-21
- **perf(images): intrinsic width/height + eager LCP image.** Body images now render with their
  stored pixel dimensions (from the `media` table) so the browser reserves the box before bytes
  arrive — eliminates layout shift (CLS). The first body image loads eagerly with
  `fetchpriority=high` (likely the LCP element) instead of lazily. `v0.9.16`.
- **feat(reading): server-side syntax highlighting (Shiki).** Code blocks are highlighted at
  render with Shiki (Vitesse light/dark, muted to fit the minimal surface) — zero client JS.
  Dual-theme tokens swap with the site's dark mode via CSS. Unknown languages / failures fall
  back to the plain escaped block. `v0.9.16`.
- **feat(search): full-text search over the article body.** The public search now also queries
  the Postgres `search` tsvector (`/api/search`, `websearch_to_tsquery('simple')`) so matches
  inside post bodies surface, merged after the instant local title/tag results. `v0.9.16`.
- **feat(admin): filter + status tabs on the posts table.** A folded title/tag search box and an
  All/Published/Draft segmented control to find posts fast as the archive grows. `v0.9.16`.
- **feat(reading): back-to-top button + wide-image mobile clamp.** A themed scroll-to-top button
  appears past the first viewport on posts; `img-wide` figures clamp to the column on phones so
  they never force horizontal scrolling. `v0.9.16`.

## 2026-06-22
- **fix(cache): tag Supabase reads + `revalidateTag('db')` on every save.** GET reads now carry
  the `db` tag (cache-eligible, so pages stay ISR); each write helper in `revalidate.ts` calls
  `revalidateTag('db','max')` alongside its `revalidatePath` superset, so a re-rendered page
  always reads fresh from Postgres — closes the window where an ISR page could serve up-to-1h
  stale data after an edit. `v0.9.15`.
- **feat(media): cron backfills missing thumbnails.** `finalizePendingThumbs` generates a
  `-thumb.webp` for any media row without a thumb (e.g. migration imports), so the library grid
  never has to load full-size originals. Runs hourly with the variant sweep. `v0.9.15`.
- **chore: code + docs cleanup after the Supabase move.** Removed the dead vanity-domain
  priming (`getSettings()` calls in read paths), tidied the data layer, and rewrote the caching
  / Blob / data-model docs (CLAUDE/ARCHITECTURE/README) to match the Postgres model; legacy
  `_index.json` scripts flagged as pre-migration. `v0.9.15`.
- **fix(media): render the canonical lowercase Blob host.** The store id is mixed-case in the
  token but the public host is lowercase; `blobBase()` now lowercases it so image URLs are
  canonical (avoids uppercase/lowercase duplicate-URL SEO). `v0.9.14`.
- **change(media): drop the vanity media domain — serve images straight from Vercel Blob.**
  Removed the `mediaBaseUrl` setting + `BLOB_PUBLIC_BASE` env + the `setMediaBase`/`publicBase`
  machinery; `expandBlob`/`blobOrigin` now always use the Blob store host. Fixes broken
  thumbnails in the media library (the proxy returned a restrictive CSP), simplifies the data
  layer (removed the now-dead `getSettings()` priming from every read), and keeps content
  store-relative so a future move (e.g. → R2) is still just a token/base swap. `v0.9.13`.
- **feat(seo): image sitemap + Article image.** `sitemap.xml` now lists each post's images
  (`<image:image>`) and the post's `BlogPosting` JSON-LD carries an `image` (featured, else the
  first body image), so search engines associate every image with its manhhung.me page even
  though the files are on the Blob host. New `extractImageUrls` helper. `v0.9.13`.
- **feat(admin): activity log — transparent record of admin actions.** Every mutation
  (post/page create·update·delete, media/file upload·delete, icon upload, settings save,
  taxonomy change, cache clear) is recorded to a Postgres `activity_log` table and shown on
  a new **Admin → Log** page (newest first, with a Clear button). Logging is toggleable in
  Settings → Features (`activityLog`, default on); writes happen via `after()` so they never
  slow the action. New `src/lib/activity.ts`, `GET/DELETE /api/activity`. `v0.9.12`.
- **feat(admin): System panel on the Overview.** Shows hosting (Vercel) + region + environment
  + commit, the database (Supabase · region · ref) with a live reachability check, and the
  media storage host. `v0.9.12`.
- **fix(media): deleting an image now removes EVERY version, original included.** Delete attempts
  the original + thumbnail + all four display variants for any raster (idempotent / no-op when a
  file is absent), regardless of the `variants` flag, so nothing is ever left orphaned on the
  store. Upload already keeps the untouched original. `v0.9.12`.
- **feat(storage): move all TEXT content from Vercel Blob to Supabase Postgres (P1.5).** Posts,
  pages, revisions, media/file metadata and settings now live in Postgres tables; the
  `_index.json` manifests + `.md` files are gone. Binaries (images, attachments, icons) stay on
  Vercel Blob, referenced store-relative (still portable, e.g. to Cloudflare R2). This kills the
  whole class of no-DB bugs at the root: **deleted images can no longer "come back"** (each row
  delete is atomic — no concurrent manifest read-modify-write to clobber), reads are always
  fresh + transactional (no `?ts` cache-bust needed; removed), and **admin save is faster** —
  the read-modify-write of the manifest is now a single atomic upsert. New `src/lib/db.ts`
  (server-only `service_role` client; reads cache-eligible for ISR, writes `no-store`).
  A Postgres `tsvector` column is in place for future body search. Schema lives in the
  `Quire Blog` Supabase project (ap-southeast-1). `v0.9.11`.
- **perf(save): display-variant (AVIF/WebP) encoding moved OFF the save request.** `savePost`/
  `savePage` return immediately after the DB write; `finalizeContentMedia` runs in the
  background via `after()` (the original always renders meanwhile). An hourly Vercel Cron
  (`/api/cron`) sweeps any still-pending variants AND keep-alives the Supabase free-tier
  project so it never pauses. `v0.9.11`.
- **fix(media): atomic batch delete — fixes "deleted unused images come back".** Root cause was
  a lost-update race, not matching: deleting several unused images fired separate requests that
  each read the same manifest and wrote their own copy, so the last write clobbered the earlier
  removals (a no-DB concurrency bug). New `deleteMediaBatch` removes ALL given URLs in ONE
  manifest read-modify-write (single delete now delegates to it), and a **"Delete all unused"**
  button (`POST /api/media/delete`) sweeps the whole unused set atomically. Blob-file cleanup is
  best-effort after the write and only touches variants that were actually generated (faster).
  `v0.9.10`.
- **fix(media): surface a silent no-match delete + add an owner diagnostic.** If the delete
  endpoint matched nothing (URL still present in the returned list), the library now shows an
  explicit error toast instead of leaving the image silently in place. Added owner-only
  `GET /api/media/debug?url=…` reporting the manifest size, the extracted match key, how many
  entries matched, a sample of stored URLs, and the configured media base — ground truth for a
  "stuck" delete. `v0.9.9`.
- **fix(media): delete now matches host-independently + writes manifest first.** Root-caused the
  "deleted image stays / re-appears in unused check" once more: the match relied on
  `collapseBlob` stripping the URL host, which silently found nothing if the primed host didn't
  equal the URL's host — so the manifest was never rewritten. Now `deleteMedia`/`deleteFile`
  match by the extracted `media/…` / `files/…` **pathname** (works for any host or a collapsed
  path, no `getSettings` priming needed), and write the reduced manifest **before** the blob-file
  cleanup so the removal sticks even if the (slower) file deletes stall. Dropped the per-delete
  settings read too (faster). `v0.9.8`.
- **style(theme): nicer public palette trigger icon** — replaced the swatch-grid glyph with
  three overlapping color circles (cleaner, clearly "color theme"). `v0.9.7`.
- **fix(media)/perf(admin): authoritative-from-write deletes (approach A).** The image/file
  delete endpoints now return the **true post-delete list, built from the in-memory manifest
  they just wrote — no Blob re-read** — and the library adopts it directly. This removes the
  read-after-write/eventual-consistency window that made a deleted image seem to "come back",
  and makes a failed server delete visible instead of silently optimistic. Hardened
  `deleteMedia`/`deleteFile`: only rewrite the manifest when an entry actually matched (never
  wipe it on a transient read failure), and sweep the original + thumb + all four display
  variants for any raster (regardless of the stored `variants` flag). `v0.9.6`.
- **chore: version in README title + repo link on the Overview pill.** The README H1 now
  carries the version (`# Quire Blog (v0.9.x)`, kept in sync on each bump), and the admin
  Overview version pill links to the repo root (`/quire`) instead of the releases page.
  `v0.9.5`.
- **feat(theme): polish the palette pickers + localize palette names.** Admin Settings →
  Appearance: the preset cards are more compact and spaced out, borderless — the selected
  palette reads via full opacity + a bold name while the rest sit dimmed (no rings/borders).
  Public switcher: a clearer swatch-grid trigger icon (the artist-palette glyph was ambiguous)
  and a wider preview chip that shows each palette's basic colors (heading/body/link/meta).
  Palette names (Mono/Sepia/Forest/Ocean/Rosé/Amber) are now **localized** via a `paletteNames`
  dict in all six admin + six public locales (no longer hardcoded in `themes.ts`).
- **chore(admin-nav): rename nav items.** "Pages / Posts" → **Content**; the appearance
  switcher now shows a fixed **"Appearance"** label instead of the current palette's name.
  Both across all six admin locales. `v0.9.4`.
- **feat(library): rename the media page to "Library" and split it into two tabs** — **Images**
  (the existing media library, unchanged) and **Files**, a new catch-all store for non-image
  attachments (PDF, zip, docx, audio…). Files upload to the `files/` Blob prefix with their own
  manifest (`files/_index.json`), with upload / copy-URL / download / delete; the site icons
  under `files/` (favicon, app icon) are excluded from the tab. New `GET/POST /api/files` +
  `DELETE /api/files/by`; nav label + page title updated across all six locales. `v0.9.3`.
- **fix(media): delete now removes ALL versions of an image from Blob and actually takes
  effect.** Two bugs in `deleteMedia`: (1) it didn't prime the vanity media base before
  `collapseBlob`, so when a custom media host was configured the deleted URL never collapsed to
  its `media/…` pathname — nothing matched and the delete silently no-op'd (the image stayed in
  the library, including "unused" items). (2) display variants (`-1024/-1600` AVIF+WebP) were
  only removed when the manifest `variants` flag was true, leaving orphans if it was stale. Now
  it primes settings first and unconditionally sweeps the thumb + all four variants for any
  raster original. `v0.9.2`.
- **docs(deploy): expanded the "Deploy to Vercel" guide into two clear methods** — (A) manual
  via the Vercel dashboard (fork → Blob store → env vars → OAuth callback → sign in), noting the
  two `vercel.json` settings to adjust for yourself (the `sin1` region is just the author's
  nearest region — change it; the 60s upload `maxDuration` can exceed the free plan); and (B) handing the whole
  install to an AI agent with Vercel + GitHub access (generic — OpenClaw / Hermes / Claude / …)
- **docs(license): make the code-vs-content split explicit.** The platform code stays
  **MIT** — free to use/modify/redistribute with **no attribution required**. Clarified that
  the blog **content** published with it (the author's writing/images, e.g. manhhung.me) is
  **© all rights reserved** and not covered by MIT. Added a "Scope" note to `LICENSE`, a
  two-layer README License section, `"license": "MIT"` in package.json, and an **MIT pill** on
  the admin Overview (links to the LICENSE) so the open-source status shows in-app too
- **chore(audit): add `audit/` log + repeatable audit procedure** (`audit/README.md`): an
  8-section pass (baseline → security → logic → perf → code quality → layout → i18n → docs)
  recorded as dated reports, so each comprehensive review starts from the last clean line.
  First report `audit/2026-06-22-comprehensive.md`. CLAUDE.md points to it; CHECKLIST gains a
  **Layout / visual** section (was missing despite the owner's alignment sensitivity)
- **fix(layout): de-duplicate the public header icon-button class into `ICON_BTN`**
  (`components/ui/iconButton.ts`). Search / palette / theme / menu each re-typed the same
  `h-10 w-10 … text-meta hover:bg-rule` string — a drift risk the "one shared class" rule
  forbids; now all four import the constant (same pattern as `ADMIN_NAV`)
- **chore: full project audit (tech / security / perf / logic) — clean.** No vulnerabilities or
  logic bugs found: every write/delete route is owner-gated, palette colors are hex-validated
  before the `<style>` emit, custom CSS strips `</style`, raw HTML in markdown is escaped,
  preview tokens use `timingSafeEqual`, RSS/sitemap output is escaped, icon upload is
  type+kind-whitelisted. Fixed stale docs/comments only: corrected the `themes.ts` header to the
  per-palette model, the CHECKLIST "Clean unused → Check unused" (read-only) line, README feature
  list (palettes/PWA/time-machine/icons) + Blob prefixes, and the ARCHITECTURE data model
  (`revisions/`, `files/`, per-palette settings) + theming/PWA design notes
- **feat(theme): visitor palette switcher (6 palettes) on public + admin headers** — like the
  dark/light toggle but for color palette. `PaletteToggle` writes `<html data-palette>` +
  localStorage; `themesToCss` emits every palette's vars so switching is instant (no reload), and
  a no-FOUC script applies the saved palette before paint. Mode (light/dark) × palette are now
  orthogonal axes
- **feat(settings): every palette is independently customizable** — admin color editor now edits
  ANY of the 6 palettes (picker = which one you're editing), each saved under `settings.themes`;
  "Set as default" picks the visitor default; per-mode reset restores that palette's built-in
  colors. Replaces the old single `theme` (auto-migrated into the default palette on read)
- **fix(settings): favicon / app icon upload moved out of the media library** to a dedicated
  `files/` store (`POST /api/files/upload`, `lib/files.ts`, `IconUpload`). **Accepts `.ico`** (the
  media library rejected it) plus PNG/SVG/JPG/WebP/GIF; site icons no longer clutter the grid

## 2026-06-21
- **feat(pwa): installable app on iPhone + Android** — add to the home screen and launch
  standalone (full-screen, no browser chrome). Dynamic `app/manifest.ts` (name/theme/icon from
  settings) + apple-touch-icon + `appleWebApp` + per-mode `theme-color` (`generateViewport`).
  New **App icon** picker in Settings (next to the favicon); icon resolves appIcon → favicon →
  bundled `public/app-icon.png`. **Installable + standalone only — no service worker / no
  offline** (kept thin on purpose; admin & API are never cached). `resolveAppIcon` in settings.ts
- **feat(settings): 6 built-in color presets** (Mono / Sepia / Forest / Ocean / Rosé / Amber),
  each a full light+dark palette tuned for readable contrast in both modes (`lib/themes.ts`).
  Appearance now opens with a palette picker (live light/dark preview swatches); selecting one
  fills both modes, and `settings.themePreset` remembers the choice so each mode's "reset"
  restores THAT preset's colors. Every color stays fully editable + savable after picking;
  the public site still renders only `theme` via `themeToCss`, so nothing is hardcoded
- **change(media): replaced the destructive "Clean unused" button with a read-only "Check
  unused" audit** (`GET /api/media/unused`, `lib/media-usage.ts`; removed `lib/sweep.ts` +
  `POST /api/media/sweep`). It badges media referenced by no post/page/settings in the grid
  and offers a "show unused only" filter — the owner deletes by hand. Now also scans **revision
  snapshots**, so an image kept only in the time machine is no longer flagged (the old sweeper
  ignored revisions and could permanently delete an image a restore still needed)
- **fix(admin): header wordmark/menu now share one h-9 box → perfectly aligned.** Removed the
  `v0.x.y` badge from beside the logo; the running version (now a link to GitHub releases)
  lives only on the Overview page. Alignment rule documented in CLAUDE.md (no more baseline drift)
- **feat(admin): media library shows each image's resolution** (`w×h`). Uploads now capture
  dimensions for svg/gif/webp too (not just jpg/png); `backfill-media-dimensions.mjs` filled the
  existing library (45 images)
- docs: corrected the changelog dates — entries had drifted into the future (up to 06-25);
  remapped to the real git timeline (work happened 06-19 → 06-21 only)
- **docs: added `ROADMAP.md`** (Vercel-or-Docker from one codebase, publishing from Markdown
  note apps, optional AI assist) and refreshed the guidance files for self-hosters: README
  stack/versions + Node 20.9+ requirement + roadmap pointer, and corrected the stale
  "full purge on every save" wording in README/ARCHITECTURE to the current scoped
  invalidation (`src/lib/revalidate.ts`). Added an `engines.node` field to `package.json`.

- **feat(admin): manage categories & tags (new Phân loại tab).** A third tab on the content
  dashboard lists every category and tag with its usage count and lets you **rename** (merges
  into an existing term) or **remove** it across ALL posts in one action (`updateTerm` →
  `POST /api/taxonomy`, owner-only; rewrites each affected `.md` + the index, then full purge)
- **feat(admin): open-in-new-tab row action.** Each published post/page row gets an
  open-in-new-tab icon (left of edit) → its public URL; drafts omit it (would 404)
- **fix(admin): mobile-friendly content tables.** Secondary columns now hide on small screens
  (posts: date `sm`, categories `md`; pages: slug `sm`) so Title + Status + actions always fit
  and the status pill never wraps awkwardly. The tab + new-post row wraps on mobile too
- **fix(admin): header alignment + bigger logo.** The `Quire Blog` wordmark, its `v0.x.y` badge
  and the menu now share one vertically-centred line (was baseline-misaligned)
- **fix(admin): header polish.** Wordmark enlarged to logo size (`text-xl`); the version
  (`v0.7.5`) sits next to it and links to GitHub releases (replaces the removed footer link).
  Every header item now shares a fixed-height (`h-9`) `ADMIN_NAV` box so the row stays
  perfectly aligned on one line (fixes the recurring "menu not lined up" drift)
- **feat(admin): cleaner, responsive header + no footer.** The admin top bar is now one
  uniform row of text links: a `Quire Blog` wordmark (bold `blog`) replaces the old bold
  "Quản trị" brand; the first nav link is now **Trang chủ** (was "Quản trị"). The three
  right-side controls (theme, clear-cache, sign-out) are styled as the SAME text links as the
  menu — no longer button-shaped — and the theme control shows the applied theme as a **word**
  instead of a sun/moon icon. On mobile the whole menu collapses behind a **hamburger** toggle
  instead of spilling inline. Removed the `Quire Blog vX · changelog` admin footer. New
  `AdminHeader` client component; `ADMIN_NAV` shared style; `ThemeToggle` gains `variant='text'`;
  `CacheButton` gains a `className`. Locale key `navAdmin` → `navHome` (all 6 languages)
- **feat(seo): richer robots.txt policy.** Replaces the bare allow-all with three groups:
  major search engines + reputable AI assistants (Googlebot/Bingbot…, GPTBot/ClaudeBot/
  PerplexityBot/Google-Extended…, paired with `/llms.txt`) are explicitly allowed; aggressive
  SEO/data scrapers (`BAD_BOTS`: AhrefsBot, SemrushBot, MJ12bot, DotBot, PetalBot, Bytespider…)
  get `Disallow: /` to save crawl budget/bandwidth; `*` stays welcoming so unknown good bots
  (incl. new AI crawlers) keep working. Bot lists are editable consts atop `app/robots.ts`.
  Still gated by `seo.robots`; `/admin` + `/api` always off-limits
- **docs(claude): document media portability / no vendor lock-in.** New "Portability"
  section in CLAUDE.md: content is stored vendor-host-free (store-relative refs), the vanity
  domain already fronts media, Vercel coupling is isolated to `src/lib/blob.ts`, and a
  step-by-step path to migrate to an S3-compatible store (e.g. Cloudflare R2) without
  rewriting content or breaking public URLs
- chore(release): pre-release audit — `build`, `lint`, `tsc` all clean; verified every
  write/delete API route is owner-gated; removed an unused var in `remap-original-images.mjs`

## 2026-06-20
- **feat(seo): dynamic OG cards for the home, category and tag pages** (same card as
  posts/pages). Home: top line = domain, bottom = site description. Category: top line = the
  name; tag: top line = `#name` (the # marks it as a tag); both bottom = domain. Honors the
  dynamic-OG toggle + fallback image like the rest;
  new `ogCardUrl`/`siteDomain` helpers in `lib/og.ts`. The OG `site` line is now length-capped
- **fix(blog): desktop table-of-contents pinned to the viewport's left edge (50px in).**
  It was absolutely positioned against the centered content column's left edge, so wide /
  full-bleed images broke out into the gutter and overlapped it. Now `fixed` to the viewport,
  vertically centred (clears header/footer), with a max-height scroll for long lists
- **fix(admin): even header action cluster.** The "Clear cache" button was missing `text-sm`
  (oversized text) and changed width while busy (the `…` suffix), making it look lopsided next
  to the nav. Clear-cache + sign-out now share one `HEADER_ACTION` class constant
  (`components/admin/headerActions.ts`) so they can't drift again; busy state is shown by
  dimming, not a width-changing label. Convention added to CLAUDE.md
- **refactor(cache): all invalidation centralized in `src/lib/revalidate.ts` + scoped purges.**
  Edits now apply reliably and without dumping the whole site each time: a new post refreshes
  only the list/taxonomy surfaces (home, pagination, every category/tag page, feed/sitemap/llms)
  and leaves other post bodies warm; editing/deleting a post also refreshes its own page;
  editing a static page touches just its URL + sitemap; settings still purge the whole site and
  now re-warm it. Each helper is a deliberate SUPERSET of affected surfaces, so a change is
  never under-purged (the old "applies late" bug). One accepted minor staleness: the related-
  posts box on other posts (self-heals ≤1h, or use "Clear all cache")
- **fix(admin): editor save now calls `router.refresh()`** (PostForm + PageForm, matching
  SettingsView) so the client Router Cache is dropped — saves show on the next navigation
  instead of lagging behind a stale RSC. Pairs with the `staleTimes` config fix below
- **feat(security): baseline security response headers on every route** (`next.config.ts`
  `headers()`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (camera/mic/geo/topics off). HSTS is
  already added by Vercel. CSP deliberately deferred (needs nonces + Report-Only rollout for
  the inline theme script + Analytics + OG + Blob images)
- fix(config): `experimental.staleTimes.static` was set to `0`, which Next 16 rejects (min 30)
  and silently ignored — leaving static routes on the ~5min client-cache default. Set to `30`
  (lowest accepted), so soft-nav freshness now matches the documented intent
- **refactor(cache): ISR pages + full purge on save (replaces the earlier force-dynamic).**
  Public pages are ISR-cached again for speed (`revalidate = 3600`; `/[slug]` prerendered via
  `generateStaticParams`), but every admin write now calls a single `revalidatePath('/',
  'layout')` that purges the WHOLE site — so an edit (content, theme/background, anything) is
  live on the next request. Reliable this time because it's ONE cache layer (no
  `unstable_cache`), the Full Route Cache is per-deployment (no cross-deploy stale), and Blob
  reads are `?ts`-busted (fresh on every regeneration). `blob.ts` reads switched from
  `cache: 'no-store'` to `{ next: { revalidate } }` so pages can be ISR-cached
- fix(settings): changing site settings (e.g. background color) now applies immediately —
  the save purges the cached layout/theme site-wide
- feat(admin): "Clear all cache" button is back and actually works — purges everything
  (`revalidatePath('/', 'layout')`) then warms the home + newest detail pages (`/api/cache/clear`)
- admin is fully `force-dynamic` (uncached) so the editor/media/settings always reflect the
  current Blob state; client Router Cache fully off (`staleTimes { dynamic: 0, static: 0 }`)

- **refactor(cache): removed the data cache entirely — content is now always fresh.**
  `unstable_cache` + tag revalidation kept fighting Blob's read-after-write and serving
  stale content (new posts missing, **deleted media reappearing**, settings not applying,
  cross-deploy Data Cache persistence). Replaced with: reads use `React.cache()` only
  (request-scoped dedup), and every public page + SEO route is `force-dynamic`. An edit
  now shows on the next plain reload — no rebuild, no "Clear cache" step
- removed the admin "Clear cache" button and `/api/cache/clear` (no cache to clear); the
  `/[slug]` page is no longer SSG (`generateStaticParams` dropped) — it renders fresh;
  dropped all cache-key versioning. Blob store confirmed in Singapore beside the functions
- fix(media): deleting an image in the library now sticks (it was the data cache re-serving
  the old manifest after the delete) — addressed by the always-fresh reads above

- fix(media): inserted images that didn't show. A `<picture>` gives NO fallback when a
  chosen `<source>` 404s, but `PostContent` emitted AVIF/WebP sources for every jpg/png
  *by convention* — so any image whose deferred variants weren't generated rendered blank.
  Now `<picture>` is emitted ONLY for originals whose variants are confirmed (media index
  `variants:true`, passed to `PostContent`); everything else is a plain `<img>` of the
  original, which always loads. Save routes also `revalidateTag('media')` so the
  optimized `<picture>` appears once variants exist. Existing broken posts self-heal
- fix(type): body text now renders at full weight — removed `-webkit-font-smoothing:
  antialiased` (body + the `<html>` `antialiased` class) which thinned glyphs and made
  reading look lighter than the old blog; dropped the negative body `letter-spacing`
  (-0.011em) that cramped accented Vietnamese. Font stays Inter; heading tracking kept
- fix(media): uploads were intermittently failing ("lúc ăn lúc không"). Root causes
  fixed: (1) the whole multi-file upload now does ONE read-modify-write of the manifest
  (`addMediaBatch`) instead of one per file, removing the lost-update race that dropped
  entries; (2) collision naming (`logo` → `logo-2`) now checks the ACTUAL store
  (`listBlobs`) ∪ manifest, so a stale manifest read can't pick a name that already
  exists; (3) `uploadFile` sets `allowOverwrite` as a final safety net so a re-upload
  never hard-throws "blob already exists"
- fix(editor): dragging an image into the editor now inserts reliably — the drop handler
  read a stale (null) editor from its capture closure; it now uses a live `editorRef`.
  Multiple dropped images upload sequentially and insert in order
- feat(seo): pagination is now path-based — `/page/2`, `/category/x/page/2`,
  `/tag/x/page/2` (was `?page=2`). Page 1 stays at the bare path; out-of-range or `/page/1`
  → 404 (no duplicate-content URLs). New `parsePathPage`; shared `BlogListing` component
- feat(read): blog list now shows reading time per post (gated by the readingTime
  feature). `readingMinutes` is computed from the body at save and stored in the index;
  `backfill-reading-time.mjs` filled it for existing posts. Index cache key → `v3`
- fix(ui): single post/page title now uses the same type scale as the blog-list title
  (one title format)

- feat(media): defer heavy variant encoding to save-time — drop/upload stores only the original + thumbnail (`variants:false`); the AVIF/WebP @1024/1600 set is generated by `finalizeContentMedia` on post/page save, only for images kept in the content (an image dropped then discarded never pays the AVIF encode). Save routes get `maxDuration=60`
- feat(media): "Clean unused" library button (`POST /api/media/sweep`, `lib/sweep.ts`) deletes media referenced by no post/page/settings — clears orphans
- feat(media): responsive image pipeline — jpg/png keep the **untouched original** + auto-generate `-1024`/`-1600` in **AVIF + WebP** + a `-thumb.webp`; `PostContent` renders `<picture>` so the browser auto-picks the lightest format/size. Library shows resolution + "download original"; delete removes all variants. svg/gif/webp stored as-is. HEIC dropped. Upload route `maxDuration=60`
- migration(blob): moved store to Singapore (`sin1`) — copied all blobs, collapsed stored URLs to pathnames, swapped `BLOB_READ_WRITE_TOKEN` (all envs), bumped cache keys for a clean cutover; media refs now store-relative end to end
- refactor(blob): store image refs **store-relative** (pathnames, not absolute URLs). `collapseBlob` on write / `expandBlob` on read in the data layer (posts/pages/settings); UI unchanged. Removes storeId lock-in — switching Blob store/region/provider needs no content rewrite. Idempotent, backward-compatible (old absolute URLs self-heal on next save)
- perf(region): `vercel.json` pins functions to `sin1` (Singapore) — was running in `iad1` (US-East), ~200ms from Vietnam; Singapore is ~40ms (Blob store also moved to Singapore, see above)

- feat(i18n): 4 new UI languages — German, Japanese, Simplified Chinese, Korean (now en/vi/de/ja/zh/ko); **English is the default**
- refactor(i18n): strings moved to `src/locales/{<code>,admin/<code>}.ts`; `langs.ts` is the single source of truth (`SITE_LANGS` + `isSiteLang`); `satisfies` enforces every key in every language; `formatDate` is now Intl-per-locale (vi keeps custom form); language picker wraps
- fix(admin): language switch is now instant (optimistic `I18nProvider` state), no longer waits for the save round-trip
- fix(i18n): localize ~32 strings that were hardcoded Vietnamese (settings cards, reader-feature toggles, SEO fields, time machine, editor toasts) — they now translate in all 6 languages
- feat(admin): "Clear cache" button in the header (purges every data-cache tag + reloads) for an immediate "see my changes now" escape hatch

- feat(admin): clearer theme colour picker. The native `<input type="color">` swatch was tiny
  with default chrome, so it didn't read as clickable — enlarged it and stripped the inner
  padding/border so it's one clean colour chip. Clicking it opens the browser's full picker
  (2D area + hue + HEX); the hex field is now monospace/uppercase alongside.
- refactor(theme): every public-UI colour now comes from the theme tokens — no hardcoded
  `neutral-*`/`white`/`black`. Exposed `--c-*` as Tailwind utilities (`bg-bg`, `text-text`,
  `text-heading`, `text-meta`, `text-link`, `border-rule`) via `@theme inline`. **All lines +
  faint surfaces (TOC border, dropdowns, header/footer, code blocks, hovers, preview banner) use
  `--c-rule`**, so one colour in Admin → Giao diện drives them. Also fixes a dark-mode bug where
  code blocks stayed light (hardcoded `#f4f4f2` had no dark override).
- fix(editor): over-spaced bullet/numbered list items. TipTap wraps each item's content in a
  `<p>`, which inherited the 1.4em paragraph margin — items now sit tight + even (only genuine
  multi-paragraph items keep spacing). Shared `.prose` rule, so the editor matches the render.
- feat(editor): rounded out the toolbar to match standard markdown editors — **numbered list**,
  **task list** (GFM `- [ ]`, renders as checkboxes), **inline code**, **horizontal rule**, and
  **insert table** (the Table extension had no way to create one from the UI). Added the TipTap
  **Placeholder** extension so the empty-state hint actually shows (the old root `data-placeholder`
  rendered nothing). New deps: `@tiptap/extension-task-list`, `-task-item`, `-placeholder`.

- feat(admin): **Media domain (CDN)** field in Settings → SEO (`mediaBaseUrl`) — set a vanity
  host for public media URLs from the UI instead of an env var. Owner setting wins, falls back
  to `BLOB_PUBLIC_BASE`; pushed into the Blob layer via `setMediaBase()` on each settings read.
  New admin i18n keys `mediaDomain`/`mediaDomainHint` (all 6 locales). Data-layer reads
  (`posts`/`pages`/`media`) now prime `getSettings()` before `expandBlob`, so the field alone
  drives media URLs reliably (no cold-start ordering race) — the env var is no longer required
- fix(header): render the logo with a plain `<img>` instead of `next/image`. The optimizer
  only allows hosts whitelisted in `next.config` at build time, so a runtime-configurable media
  domain (Settings → Media domain / a Cloudflare Worker) made the optimized logo 404. A plain
  tag loads from whatever host the setting yields — no build coupling, no env, never breaks on a
  domain change. Logos are small + CDN-cached, so the lost optimization is negligible
- feat(seo): `/sitemaps.xml` 308-redirects to `/sitemap.xml` (alias for the plural form / old
  search-console submissions; no second sitemap to keep in sync)
- feat(media): optional vanity domain for public media URLs via `BLOB_PUBLIC_BASE` (e.g. a
  Cloudflare Worker on `files.<domain>` proxying the Blob store). `publicBase()` rewrites only
  rendered media URLs (`expandBlob` + `blobOrigin` preconnect); internal data reads stay on the
  store host (no proxy hop, `?ts` cache-bust intact). `collapseBlob` also strips the vanity host
- fix(content): restored 41 broken post images across 19 imported posts. A prior media wipe
  (removed small/resized versions) left these `media/...` refs 404ing. Re-fetched the ORIGINAL
  full-size files from the source WordPress site via the Rocket.net file API (the public domain
  is behind a Cloudflare challenge that blocks direct fetch), stripping WP `-WxH` resize
  suffixes; uploaded to Blob, rewrote the markdown, rebuilt `media/_index.json`. New scripts:
  `check-image-links.mjs` (audit), `remap-original-images.mjs` (recover + remap)
- feat(seo): SEO tab — JSON-LD schema, `sitemap.xml`, `robots.txt`, `llms.txt`, RSS `feed.xml`, dynamic OG image (`/og`, edge runtime), canonical `siteUrl`; all toggleable
- feat(read): client-side `/search` (lean pre-folded index), table of contents (desktop, sticky), reading-progress bar, related posts, reading time
- feat(admin): `Tính năng` tab — toggle reader features (search/toc/related/readingTime/progressBar); `Link nháp` HMAC draft-preview links (`/preview/[slug]`)
- feat: `@vercel/analytics`; themed `(blog)/not-found.tsx`
- perf: every Blob read wrapped in `unstable_cache` (tags posts/pages/media/settings) → `/[slug]` is now real SSG; `staleTimes { dynamic: 0, static: 180 }`; logo via `next/image`; modern `browserslist` drops legacy-JS polyfills; editor serialization debounced
- fix: public reads degrade to fallback instead of 500; bump `getSettings` cache key (Data Cache persists across deploys)
- refactor(dry): consolidate 3 toggle components into `ui/Switch.tsx`; one `<hr>` divider standard (50% left); no all-caps; drop dead classes
- docs: add `ARCHITECTURE.md`; refresh README caching/usage
- perf: replace `resolveUrl` (`list()` API call) with direct `blobUrl()` — halves Blob read latency
- perf: `getPublicPosts`, `getSettings`, `getPublicPages` cached via `unstable_cache` — cross-request cache with tag-based invalidation
- perf: `getPost` / `getPage` wrapped with `React.cache()` — deduplicates generateMetadata + page render calls
- perf: `[slug]/page.tsx` — `generateStaticParams` + `dynamicParams = true` for ISR (falls back to dynamic due to `revalidate: 0` Blob fetches, but structure is correct)
- perf: all admin write routes call `revalidateTag` / `revalidatePath` after save/delete
- fix: `BLOB_READ_WRITE_TOKEN` regex corrected to `vercel_blob_rw_` (was `vercelblob_rw_`)
- feat: `next.config.ts` — added Vercel Blob image remote patterns
- docs: CLAUDE.md expanded with Blob access, caching model, ISR, data layer reference, scripts

## 2026-06-19
- init: project bootstrapped by Claude Code
- feat: env-driven OAuth providers (Google and/or GitHub)
- feat: Blob-backed posts + media data layer (no database)
- feat: NextAuth v5 GitHub auth with single-owner authorization
- feat: admin dashboard, TipTap markdown editor, media library
- feat: public blog (home, post detail, category, tag) in Vietnamese UI
