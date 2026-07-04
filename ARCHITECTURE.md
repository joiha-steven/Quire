# Architecture

A fresh-reader map of Quire Blog: the mental model, how a request flows, and the
*why* behind the main decisions. Operational rules, invariants, and a per-area DEBUG
ROUTER live in [`CLAUDE.md`](./CLAUDE.md); per-area detail lives in [`docs/`](./docs/)
(conventions, features, seo-pwa, mcp, backups).

## Mental model

A single-owner, AI-operated blog. **Text content lives in PostgreSQL;
binaries (images, attachments, icons) live on the local filesystem.** The app is a thin
Next.js (App Router) layer: `src/lib` is the data layer (`db.ts` = Postgres,
`blob.ts` = binaries only), `src/app/api` are thin write routes, `src/app/(blog)`
is the public site, `src/app/admin` is the owner console. Post/page bodies are
**Markdown stored in a text column** (portable, exportable). Quire self-hosts two
ways: **native on a Linux server** (primary) or **Docker via docker compose** (secondary).

## Data model

PostgreSQL, schema `public`:

```
posts            slug PK · title · date · status · categories[] · tags[] · featured_image
                 · excerpt · reading_minutes · content (markdown) · search (tsvector) · deleted_at
pages            slug PK · title · status · featured_image · content (markdown) · deleted_at
post_revisions   slug · data (jsonb snapshot) · saved_at   (app keeps last 3 / slug)
media            path PK · filename · size · width · height · thumb · variants · uploaded_at · deleted_at
files            url PK · filename · size · content_type · uploaded_at · deleted_at
settings         single row id=1 · data (jsonb SiteSettings)
mcp_tokens       id · name · token_hash (sha256, unique) · prefix · created_at · last_used_at  (MCP access tokens; max 5, hash only)
activity_log     at · action · detail   (admin audit trail, Admin → Log; toggleable)
```

The local store (under `STORAGE_LOCAL_DIR`, served at `/uploads`) holds only the
binaries: `media/{name}.{ext}` (original + responsive variants + thumbnail) and
`files/{...}` (attachments + site icons). Posts + pages share one `/{slug}` URL
namespace (`ensureSlugFree`).

`deleted_at` powers a **Trash** (soft delete): every delete just timestamps the row, so
all four kinds are recoverable; live reads filter `deleted_at is null`. Media/file soft
delete keeps the file (a published post's images never break), removed only on an explicit
purge. Admin → Trash restores or permanently removes per kind — nothing auto-purges.

Reads are always fresh + transactional (no manifest read-modify-write, no
read-after-write staleness). Image refs are stored **store-relative** (pathnames
like `media/x.jpg`); the data layer collapses on write / expands on read
(`collapseBlob`/`expandBlob`), so content carries no store location and the binary store
can move without rewriting anything.

## Request flow

- **Public read**: server components call `src/lib` (`getPublicPosts`, `getPost`,
  `getSettings`, …). Pages are **ISR-cached** (`revalidate = 3600`; `/[slug]` prerendered
  via `generateStaticParams`), so visitors get fast cached HTML. The DB reads are
  cache-eligible + tagged `db` (so pages can stay static) and deduped per request with
  `React.cache()`; a save calls `revalidateTag('db')` so any re-render reads fresh from
  Postgres. Pagination is path-based (`/page/[n]`, `/category/[slug]/page/[n]`,
  `/tag/[slug]/page/[n]`; page 1 at the bare path).
- **Write** (owner only): `src/app/api/*` routes call `requireOwner()`, mutate Postgres
  (and the local store for binaries) via `src/lib`, then invalidate through one place
  (`src/lib/revalidate.ts`): a new
  post refreshes the list/taxonomy surfaces, editing a post also refreshes its own page,
  a settings change purges the whole site. Each purge is a deliberate superset of what a
  change touches, so the edit is live on the next request without under-purging. Admin is
  `force-dynamic` (uncached); editor saves also `router.refresh()`. A "Clear all cache"
  button purges everything + warms.
- **Render**: Markdown → HTML via `marked` (raw HTML is escaped, never executed);
  images become `<figure>`, lone video URLs become embeds, H2/H3 get slug ids.

## Codebase map

| Path | What |
|---|---|
| `src/lib/db.ts` | `supabase-js` client (server-only, `service_role`) pointed at PostgREST. Custom fetch: GET reads cache-eligible + tagged `db`; writes `no-store`; strips `/rest/v1` when `POSTGREST_DIRECT=1`. |
| `src/lib/blob.ts` | Binary I/O only (images/files/icons). Facade over the local fs driver `blob-local.ts` (served at `/uploads`), lazy-loaded so `node:fs` stays off the client. |
| `src/lib/{posts,pages,media,settings,revisions,activity}.ts` | Data layer over Postgres; `React.cache()` request dedup. `activity` = the admin activity log. |
| `src/lib/{utils,i18n,og,preview,video,paginate,slugs,api,media-usage,themes,files}.ts` | Pure helpers + shared route helpers (`media-usage` = read-only unused-media audit; `themes` = the 6 built-in palettes + CSS emit; `files` = site-icon + attachment store). |
| `src/locales/` | UI strings per language (en/vi/de/ja/zh/ko); `types.ts` shapes, `langs.ts` registry; `satisfies` enforces every key. |
| `src/app/(blog)/` | Public site (home, `/[slug]`, category, tag, search, preview, not-found). |
| `src/app/admin/` | Owner console (editor, media, settings, trash). |
| `src/lib/mcp/` + `src/app/api/mcp/` | MCP server: tools (thin wrappers over the data layer) + the `/api/mcp` endpoint, the thin OAuth flow, `/.well-known/*` metadata, and admin-managed access tokens (`tokens.ts` + `mcp_tokens`). Enabled + tokenized from Admin → Settings → Advanced. |
| `src/app/{robots,sitemap,llms.txt,feed.xml,og}` | SEO / feeds / dynamic share image. |
| `src/components/{blog,admin,ui,theme}/` | UI. `ui/` = shared primitives (Button, Input, Switch, Toast). |

## Design decisions (the *why*)

- **Postgres for text, local files for binaries** → real queries (lists, taxonomy,
  full-text), atomic writes (no manifest clobber), and always-fresh reads, while
  binaries stay cheap + portable as plain files. The old no-DB model used
  `_index.json` manifests as the query layer; every write did a read-modify-write
  that, under CDN cache + concurrency, repeatedly **clobbered the index** and
  resurrected deleted images. Postgres removes that whole class of bug at the root.
  Secrets (the `service_role` key) live only in the gitignored `.env.local` (native) / `.env.docker` (Docker).
- **ISR pages + tagged DB reads, purged on save** → pages are ISR-cached for speed; the
  DB reads are cache-eligible (so pages can be static) and tagged `db`. Every save,
  through `src/lib/revalidate.ts`, calls `revalidateTag('db')` (next render reads fresh from
  Postgres) AND a `revalidatePath` superset (decides which pages re-render). Postgres is always
  consistent, so this is reliable — unlike the old no-DB model where CDN staleness +
  per-tag bookkeeping over `unstable_cache` repeatedly served stale content. Never set the DB
  reads to `no-store` (it would force every page dynamic, killing ISR).
- **Store-relative image refs (`collapseBlob`/`expandBlob`)** → stored content holds
  pathnames, not absolute URLs, so the store location is never baked in. `collapseBlob`
  strips the `/uploads` prefix on write, `expandBlob` re-adds it on read, so the store
  directory can move without rewriting any content.
- **Binaries are plain files on disk behind the `blob.ts` facade** → images/files/icons are
  written under `STORAGE_LOCAL_DIR` and served at `/uploads` by `app/uploads/[...path]`. `blob.ts`
  is a thin facade that lazy-loads `blob-local.ts` so `node:fs` stays off the client. Because refs
  are store-relative (see above), the store directory can move without rewriting content. Uploads
  are POSTed to a server route (a Node host has no 4.5 MB body cap). `no-direct-blob` guards that no
  cloud storage SDK sneaks into `src`. **One codebase:** the image needs no backend env to build (the
  data layer degrades to empty), so the same source runs native or in Docker.
- **Postgres + PostgREST, supabase-js as the client.** The data layer speaks to **PostgREST** over
  Postgres via the `supabase-js` library, and uses nothing else from that stack (no Auth/Realtime/Storage
  — sign-in is NextAuth, binaries are local files). The single seam is in `db.ts`: when `POSTGREST_DIRECT=1`
  the custom `dbFetch` strips the `/rest/v1` path prefix supabase-js adds (bare PostgREST serves tables at
  `/`), so supabase-js hits PostgREST directly with no proxy container. Postgres applies `scripts/schema.sql`
  + a role/grant bootstrap on first init; `service_role` is `BYPASSRLS` (every table has RLS on with no
  policies). **Docker** bundles Postgres + PostgREST + the local store; **native** installs them directly.
  Net: no cloud account — text in a local Postgres volume, binaries on a local disk volume.
- **100% Markdown, raw HTML escaped** → safe, portable content; videos are bare URLs
  embedded at render, not stored iframes.
- **Responsive images, encoding deferred to save** → jpg/png uploads keep the
  untouched **original** + a thumbnail immediately; the heavy AVIF/WebP @1024/1600 set
  is generated on save (`finalizeContentMedia`) only for images kept in the content,
  and `PostContent` emits a `<picture>` so the browser picks the lightest format/size.
  Orphans (dropped-then-discarded) are surfaced by the read-only "Check unused"
  audit, which badges media referenced nowhere (incl. revision snapshots) for
  manual deletion — it never deletes on its own. The
  dynamic OG image (`/og`) runs on the **edge** runtime so its bundled font loads
  (Node `fetch` can't read a `file://` URL).
- **Draft preview = HMAC token** (`/preview/[slug]?key=`) on a separate route → share a
  draft without login while keeping `/[slug]` published-only.
- **Reader features are toggleable** (`settings.features`) and **one divider style**
  (the global 50%-width left `<hr>`; no all-caps, no bespoke `border-t` rules).
- **Theming = two orthogonal axes: mode × palette.** Light/dark/system/by-time is a
  `.dark` class on `<html>`; the 6 color palettes are a `data-palette` attribute. The
  layout emits every palette's CSS vars once (`themesToCss`), so a visitor's switch is
  attribute-only (no server round-trip), and a no-FOUC inline script applies both before
  paint. Every palette is owner-customizable; colors are validated as hex on save, so the
  injected `<style>` can't be broken out of.
- **Per-role type system + uploadable font, no hardcoded sizes.** Every reader-facing text maps
  to one of 9 roles (h1–h5, body, small, caption, code), each with its own size/line-height/
  letter-spacing flowing from CSS vars (`--fs-*`/`--lh-*`/`--ls-*`); the layout injects the owner's
  `settings.typography` as a `:root` override after the baked-in defaults. An optional per-weight
  `@font-face` set (`settings.customFont` = family + faces, stored under `files/`, one file
  per weight) overrides `--font-sans` (Inter fallback) — per-weight because the site disables
  faux-bold. Titles use `.fs-h*` utilities, secondary text `.t-small`; single post/page titles +
  list-page headings are H1, list cards H2. **One typeface for the whole reading site** — body,
  headings, and code all use `--font-sans` (no separate monospace family). Customizable (with
  reset) in Admin → Settings, split into General / Appearance / Advanced tabs.
- **Installable PWA, no service worker** → `app/manifest.ts` builds the manifest from
  settings (title, palette color, uploaded icon); standalone launch only — offline is
  intentionally out of scope, so there is nothing to register/cache and admin/API are
  never served stale.
- **Off-server backups to the owner's Google Drive.** Your Postgres + uploads dir are your primary
  data; Drive is *off-server redundancy* + a one-click restore point, not primary safety.
  A snapshot is one self-contained `.tar.gz` (DB dump + every binary) because a single file is the
  easiest thing to retain (delete one = drop a snapshot) and to restore (one file = the whole
  site). Drive auth is a **separate** `drive.file` consent (not the login scope) so signing in
  stays unchanged and the app can only touch files it created; the refresh token is the one true
  secret, so it lives server-side in `backup_state`, never in the client-bound `settings` blob.
  Uploaded binaries are immutable, so even "full every run" stays cheap to produce.

## Conventions

400-line cap per file · no `any` · UI strings go through `src/locales/` (6 languages,
never hardcoded), code/comments English · every API route logs + `requireOwner()`
first. See [`CLAUDE.md`](./CLAUDE.md).
Next.js 16 here differs from training data — read `node_modules/next/dist/docs/`
(see [`AGENTS.md`](./AGENTS.md)).
