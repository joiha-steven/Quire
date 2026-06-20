# Architecture

A fresh-reader map of vibeblog: the mental model, how a request flows, and the
*why* behind the main decisions. Operational detail, traps, and recovery all live
in [`CLAUDE.md`](./CLAUDE.md).

## Mental model

A single-owner, AI-operated blog with **no database**. All content is files in
**Vercel Blob**. The app is a thin Next.js (App Router) layer over Blob:
`src/lib` is the data layer, `src/app/api` are thin write routes, `src/app/(blog)`
is the public site, `src/app/admin` is the owner console. Content is **100% Markdown**.

## Data model (Vercel Blob, no DB)

```
posts/_index.json     array of post metadata  ← the query layer (no bodies)
posts/{slug}.md       frontmatter + markdown body
pages/{slug}.md       static pages (no taxonomy/date) + pages/_index.json
media/{name}.{ext}    original upload + responsive variants + media/_index.json
settings/site.json    SiteSettings (theme, menu, siteUrl, seo, features)
```

The `_index.json` manifests are the only "query" mechanism: lists read the
manifest, detail pages read one `.md`. Every write does a read-modify-write of the
manifest. Posts + pages share one `/{slug}` URL namespace (`ensureSlugFree`).

Stored content is **store-relative**: image refs are kept as pathnames
(`media/x.jpg`), not absolute URLs. The data layer collapses on write / expands on
read (`collapseBlob`/`expandBlob`), so content carries no storeId and the Blob store
can change without rewriting anything (see Design decisions).

## Request flow

- **Public read**: server components call `src/lib` (`getPublicPosts`, `getPost`,
  `getSettings`, …). Pages are **ISR-cached** (`revalidate = 3600`; `/[slug]` prerendered
  via `generateStaticParams`), so visitors get fast cached HTML. There is **no data cache**:
  reads use `React.cache()` for request-scoped dedup, and the Blob fetch is cache-eligible
  but `?ts`-busted, so each (re)generation reads fresh. Pagination is path-based (`/page/[n]`,
  `/category/[slug]/page/[n]`, `/tag/[slug]/page/[n]`; page 1 at the bare path).
- **Write** (owner only): `src/app/api/*` routes call `requireOwner()`, mutate Blob via
  `src/lib`, then invalidate the cache through one place (`src/lib/revalidate.ts`): a new
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
| `src/lib/blob.ts` | All Blob I/O. URLs are deterministic from the token (no `list()` to read). Reads cache-bust + degrade to fallback on error. |
| `src/lib/{posts,pages,media,settings}.ts` | Data layer; `React.cache()` dedup only (no cross-request cache). |
| `src/lib/{utils,i18n,og,preview,video,paginate,slugs,api,media-usage}.ts` | Pure helpers + shared route helpers (`media-usage` = read-only unused-media audit). |
| `src/locales/` | UI strings per language (en/vi/de/ja/zh/ko); `types.ts` shapes, `langs.ts` registry; `satisfies` enforces every key. |
| `src/app/(blog)/` | Public site (home, `/[slug]`, category, tag, search, preview, not-found). |
| `src/app/admin/` | Owner console (editor, media, settings). |
| `src/app/{robots,sitemap,llms.txt,feed.xml,og}` | SEO / feeds / dynamic share image. |
| `src/components/{blog,admin,ui,theme}/` | UI. `ui/` = shared primitives (Button, Input, Switch, Toast). |

## Design decisions (the *why*)

- **No database** → zero ops, content portable as files, the repo stays free of
  personal data (secrets live only in the gitignored `.env.local` + Vercel).
  Trade-off: no rich queries, so the `_index.json` manifest is the single query layer.
- **Mutable Blob written with `cacheControlMaxAge: 0` + cache-busted reads** →
  Blob's default 1-year CDN cache once served a stale `_index.json` after a save and
  the read-modify-write **clobbered the index**. Mutable content must never be stale.
- **One cache layer (ISR pages) + scoped purge on save; no data cache** → pages are
  ISR-cached for speed; every save invalidates through `src/lib/revalidate.ts` (scoped per
  change but always a superset of affected surfaces), and Blob reads are `?ts`-busted so
  regeneration is always fresh. We first tried `unstable_cache` + tag revalidation (two
  cache layers) and it repeatedly served stale content — missing posts, reappearing deleted
  images, settings not applying, Data Cache persisting across deploys. This model fixes that
  because: one layer not two; the Full Route Cache is per-deployment (no cross-deploy stale);
  each save purges a superset of what changed (never under-purges); and `?ts` guarantees
  fresh Blob. Never reintroduce a cross-request data cache over Blob, and never set the Blob
  reads to `no-store` (it would force every page dynamic).
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

## Conventions

400-line cap per file · no `any` · UI strings go through `src/locales/` (6 languages,
never hardcoded), code/comments English · every API route logs + `requireOwner()`
first. See [`CLAUDE.md`](./CLAUDE.md).
Next.js 16 here differs from training data — read `node_modules/next/dist/docs/`
(see [`AGENTS.md`](./AGENTS.md)).
