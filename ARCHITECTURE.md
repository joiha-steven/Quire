# Architecture

A fresh-reader map of vibeblog: the mental model, how a request flows, and the
*why* behind the main decisions. Operational detail, traps, and recovery all live
in [`CLAUDE.md`](./CLAUDE.md).

## Mental model

A single-owner, AI-operated blog. **Text content lives in Supabase Postgres;
binaries (images, attachments, icons) live in Vercel Blob.** The app is a thin
Next.js (App Router) layer: `src/lib` is the data layer (`db.ts` = Postgres,
`blob.ts` = binaries only), `src/app/api` are thin write routes, `src/app/(blog)`
is the public site, `src/app/admin` is the owner console. Post/page bodies are
**Markdown stored in a text column** (portable, exportable).

## Data model

Postgres (project `vibeblog`, ap-southeast-1), schema `public`:

```
posts            slug PK · title · date · status · categories[] · tags[] · featured_image
                 · excerpt · reading_minutes · content (markdown) · search (tsvector)
pages            slug PK · title · status · featured_image · content (markdown)
post_revisions   slug · data (jsonb snapshot) · saved_at   (app keeps last 3 / slug)
media            path PK · filename · size · width · height · thumb · variants · uploaded_at
files            url PK · filename · size · content_type · uploaded_at
settings         single row id=1 · data (jsonb SiteSettings)
activity_log     at · action · detail   (admin audit trail, Admin → Log; toggleable)
```

Vercel Blob holds only the binaries: `media/{name}.{ext}` (original + responsive
variants + thumbnail) and `files/{...}` (attachments + site icons). Posts + pages
share one `/{slug}` URL namespace (`ensureSlugFree`).

Reads are always fresh + transactional (no manifest read-modify-write, no
read-after-write staleness). Image refs are stored **store-relative** (pathnames
like `media/x.jpg`); the data layer collapses on write / expands on read
(`collapseBlob`/`expandBlob`), so content carries no storeId and the binary store
can change (e.g. → Cloudflare R2) without rewriting anything.

## Request flow

- **Public read**: server components call `src/lib` (`getPublicPosts`, `getPost`,
  `getSettings`, …). Pages are **ISR-cached** (`revalidate = 3600`; `/[slug]` prerendered
  via `generateStaticParams`), so visitors get fast cached HTML. The Supabase reads are
  cache-eligible + tagged `db` (so pages can stay static) and deduped per request with
  `React.cache()`; a save calls `revalidateTag('db')` so any re-render reads fresh from
  Postgres. Pagination is path-based (`/page/[n]`, `/category/[slug]/page/[n]`,
  `/tag/[slug]/page/[n]`; page 1 at the bare path).
- **Write** (owner only): `src/app/api/*` routes call `requireOwner()`, mutate Postgres
  (and Blob for binaries) via `src/lib`, then invalidate through one place
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
| `src/lib/db.ts` | Supabase client (server-only, `service_role`). Custom fetch: GET reads cache-eligible + tagged `db`; writes `no-store`. |
| `src/lib/blob.ts` | Binary I/O only (images/files/icons). URLs deterministic from the token (lowercase store host; no vanity domain, no `list()` to read). |
| `src/lib/{posts,pages,media,settings,revisions,activity}.ts` | Data layer over Postgres; `React.cache()` request dedup. `activity` = the admin activity log. |
| `src/lib/{utils,i18n,og,preview,video,paginate,slugs,api,media-usage,themes,files}.ts` | Pure helpers + shared route helpers (`media-usage` = read-only unused-media audit; `themes` = the 6 built-in palettes + CSS emit; `files` = site-icon + attachment store). |
| `src/locales/` | UI strings per language (en/vi/de/ja/zh/ko); `types.ts` shapes, `langs.ts` registry; `satisfies` enforces every key. |
| `src/app/(blog)/` | Public site (home, `/[slug]`, category, tag, search, preview, not-found). |
| `src/app/admin/` | Owner console (editor, media, settings). |
| `src/app/{robots,sitemap,llms.txt,feed.xml,og}` | SEO / feeds / dynamic share image. |
| `src/components/{blog,admin,ui,theme}/` | UI. `ui/` = shared primitives (Button, Input, Switch, Toast). |

## Design decisions (the *why*)

- **Postgres for text, Blob for binaries** → real queries (lists, taxonomy,
  full-text), atomic writes (no manifest clobber), and always-fresh reads, while
  binaries stay cheap + portable as plain files. The old no-DB model used
  `_index.json` manifests as the query layer; every write did a read-modify-write
  that, under Blob's CDN cache + concurrency, repeatedly **clobbered the index** and
  resurrected deleted images. Postgres removes that whole class of bug at the root.
  Secrets (the `service_role` key) live only in the gitignored `.env.local` + Vercel.
- **ISR pages + tagged DB reads, purged on save** → pages are ISR-cached for speed; the
  Supabase reads are cache-eligible (so pages can be static) and tagged `db`. Every save,
  through `src/lib/revalidate.ts`, calls `revalidateTag('db')` (next render reads fresh from
  Postgres) AND a `revalidatePath` superset (decides which pages re-render). Postgres is always
  consistent, so this is reliable — unlike the old no-DB model where Blob's CDN staleness +
  per-tag bookkeeping over `unstable_cache` repeatedly served stale content. Never set the DB
  reads to `no-store` (it would force every page dynamic, killing ISR).
- **Store-relative image refs (`collapseBlob`/`expandBlob`)** → stored content holds
  pathnames, not absolute Blob URLs, so the storeId is never baked in. Switching Blob
  store / region / provider needs only a token change, no content rewrite. (Used to
  move the store to **Singapore (`sin1`)** — see `vercel.json`; functions run there too.)
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
- **Installable PWA, no service worker** → `app/manifest.ts` builds the manifest from
  settings (title, palette color, uploaded icon); standalone launch only — offline is
  intentionally out of scope, so there is nothing to register/cache and admin/API are
  never served stale.

## Conventions

400-line cap per file · no `any` · UI strings go through `src/locales/` (6 languages,
never hardcoded), code/comments English · every API route logs + `requireOwner()`
first. See [`CLAUDE.md`](./CLAUDE.md).
Next.js 16 here differs from training data — read `node_modules/next/dist/docs/`
(see [`AGENTS.md`](./AGENTS.md)).
