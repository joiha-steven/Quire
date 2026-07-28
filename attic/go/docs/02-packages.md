# Package map: `src/lib` and the routes, in Go

Source: the data-layer map in `CLAUDE.md`, 106 files in `src/lib`, 62 API routes,
14 admin pages, 10 public routes.

## Package layout

```
internal/
  store/       sqlc output, migrations, tx helpers, the two DB handles
  model/       shared structs (Post, Page, Media, Settings, ...)
  blob/        binaries on the filesystem, served at /uploads
  render/      markdown -> HTML
  content/     posts, pages, revisions, slugs, taxonomy, series, scheduled, search
  media/       image + file metadata, libvips pipeline, variants
  settings/    settings, themes, typography, custom fonts, site icons
  comments/    comment tree, limited markdown, Turnstile
  mail/        SMTP, subscribers, broadcast, reply notify, email templates
  analytics/   record, query, UA buckets, bot detection, timezone bucketing
  mcp/         MCP server, OAuth DCR, tokens, replay guard
  backup/      export/import archive, litestream config
  auth/        Google OAuth, session cookie, dev login
  i18n/        locales, 6 languages
  cache/       full-page cache and invalidation
  httpx/       middleware: logging, rate limit, redirects, security headers, errors
  web/         public HTTP handlers + templ templates
  adminui/     admin HTTP handlers + templ templates
  api/         JSON endpoints consumed by admin JavaScript
```

## `src/lib` to package mapping

| Current file(s) | Go destination | Notes |
|---|---|---|
| `db.ts` | `store` | PostgREST client disappears entirely. sqlc-generated methods on two `*sql.DB` |
| `blob.ts`, `blob-local.ts` | `blob` | `collapseBlob`/`expandBlob` survive as `Collapse`/`Expand`. Invariant 3 unchanged |
| `posts.ts`, `pages.ts` | `content` | `React.cache()` disappears; see "Caching" below |
| `revisions.ts` | `content` | Last 3 per slug, unchanged |
| `slugs.ts` | `content` | `ensureSlugFree` + `SlugConflictError` -> `ErrSlugConflict`. Invariant 2 |
| `taxonomy.ts` | `content` | `termSlug`/`resolveTerm` become pure funcs over `post_terms` |
| `series.ts`, `series-order.ts` | `content` | The pure/impure split existed only because the edge runtime could not import `db`. In Go it collapses into one file |
| `scheduled.ts` | `content` | `sweepScheduled`/`newlyLive` run on an in-process ticker, not an external cron call |
| `media.ts`, `files.ts`, `image.ts`, `mime.ts` | `media` | The `O_EXCL` exclusive-write trick for concurrent same-name uploads carries over verbatim; it is load-bearing |
| `upload-client.ts` | `assets/js` | Browser side |
| `settings.ts`, `themes.ts` | `settings` | `typographyToCss`/`fontToCss`/`themesToCss` emit CSS strings; same output |
| `comments.ts`, `comment-md.ts`, `comment-tree.ts`, `turnstile.ts`, `comment-env.ts` | `comments` | Tree rebuild, re-rooting orphans, tombstones: same algorithm |
| `subscribers.ts`, `mail.ts`, `newsletter-log.ts`, `broadcast.ts`, `comment-notify.ts`, `newsletter-email.ts`, `email-brand.ts` | `mail` | `sendMail` stays the single choke point that writes `newsletter_sends` |
| `analytics.ts`, `ua.ts` | `analytics` | Plus the four RPCs, see 01-schema.md |
| `mcp/*` (~1400 lines incl. routes) | `mcp` | JSON-RPC over HTTP + SSE. Token hash format preserved |
| `backup.ts`, `backup-state.ts`, `gdrive.ts` | `backup` | Drive removed (parity exception #1). Export/import archive stays |
| `auth.ts`, `auth-shared.ts`, `api.ts` | `auth`, `httpx` | `requireOwner()` becomes middleware. Invariant 4 |
| `revalidate.ts` | `cache` | See "Caching" below |
| `redirects.ts`, `redirect-path.ts` | `httpx` | The edge/node split disappears; one middleware reads one map |
| `rate-limit.ts` | `httpx` | Same sliding window, in memory |
| `highlight.ts` | `render` | Shiki -> Chroma |
| `footnotes.ts`, `inline-md.ts`, `toc.ts`, `video.ts` | `render` | goldmark extensions instead of pre/post passes over `marked` output, where possible |
| `og.ts` | `web` | Satori -> `fogleman/gg` |
| `i18n.ts`, `admin-i18n.ts`, `locales/*` | `i18n` | JSON files carried over unchanged, loaded with `go:embed` |
| `wordpress-import.ts` | `cmd/import-wxr` or `internal/content` | Pure WXR parse; `encoding/xml` + a HTML-to-markdown pass |
| `media-usage.ts` | `media` | Read-only orphan audit |
| `activity.ts` | `store` + middleware | Fire-and-forget, never throws |
| `integration-keys.ts` | `settings` | Server-only secrets table, never in the client payload |
| `preview.ts`, `paginate.ts`, `utils.ts`, `cdn.ts`, `safe-fetch.ts`, `settings-sanitize.ts` | assorted | Small pure helpers, placed with their consumer |
| `env.ts`, `instrumentation.ts` | `cmd/quire` | Validate config at boot, fail fast |

## Caching: the biggest simplification

Today: Next ISR (`revalidate = 3600`) plus tagged Data Cache reads plus
`lib/revalidate.ts`, which must fire a `revalidatePath` **superset** of whatever a
write touched. Invariant 1 exists because under-purging silently serves stale pages,
and it needs a dedicated test plus a static guard (`check:token-bust`) plus a
documented gotcha about `fetchCache = 'force-no-store'` on admin routes.

In Go:

```go
// internal/cache
type Pages struct { mu sync.RWMutex; m map[string][]byte }
func (p *Pages) Get(key string) ([]byte, bool)
func (p *Pages) Put(key string, html []byte)
func (p *Pages) Clear()   // called after EVERY write, unconditionally
```

Key is `method + path + locale + theme`. Any admin write, any MCP write, any import,
any settings change calls `Clear()`.

This is a full flush rather than a targeted purge, which sounds wasteful and is not:
a blog has on the order of hundreds of pages, each re-renders in well under a
millisecond from SQLite, and writes are rare. What it buys is that **Invariant 1
becomes structurally impossible to violate**. There is no superset to get wrong, no
tag to forget, no out-of-band write that needs special handling. The test, the static
guard, and the documented gotcha all disappear with it.

Warmup after `Clear()` is optional and probably unnecessary; add it only if measured.

## Invariants carried over

The seven invariants in `CLAUDE.md` are the most valuable artifact in the old repo.
Each gets a Go test in the same package as its enforcement point.

| # | Invariant | Where it lives in Go | Status |
|---|---|---|---|
| 1 | Revalidate is a superset, never under-purge | `cache` | **Dissolved.** Full flush makes it unbreakable. Keep a test asserting every write path calls `Clear()` |
| 2 | Posts and pages share one `/{slug}` namespace | `content.EnsureSlugFree` | Carried, same test |
| 3 | Image refs stored store-relative | `blob.Collapse` / `blob.Expand` | Carried, same test |
| 4 | Every write route is owner-gated | `httpx.RequireOwner` middleware | **Strengthened.** Instead of a static presence check, mount every write route on a router group that has the middleware attached. A route cannot be added without it |
| 5 | Raw HTML in markdown escaped, never executed | `render` | Carried. goldmark with `html.WithUnsafe()` NOT set, plus the `safeHref` scheme filter |
| 6 | Every delete is a soft delete | `store`, `liveOnly()` predicate | Carried. Express as a shared SQL fragment in the sqlc queries, defined once |
| 7 | Cache-bust is asymmetric | n/a | **Dissolved** along with #1 |

Invariants 1, 4 and 7 all get structurally better. That is the strongest argument for
the rewrite that is not about payload size.

## Route mapping

### Public (10 routes, `internal/web`)

```
/                          index, paginated at /page/{n}
/{slug}                    post or page, shared namespace
/category/{slug}           + /page/{n}
/tag/{slug}                + /page/{n}
/series/{slug}
/search
/preview/{slug}            token-gated draft preview
/feed.xml  /sitemap.xml  /sitemaps.xml  /robots.txt  /llms.txt  /manifest.webmanifest
/og/{...}                  generated OG images
/uploads/{...}             binaries
/.well-known/{...}         agent discovery
/api/md/{slug}             markdown negotiation
```

### Admin (14 pages, `internal/adminui`, server-rendered)

```
/admin                     overview
/admin/content             posts + pages tables
/admin/editor  /admin/editor/{slug}
/admin/page-editor  /admin/page-editor/{slug}
/admin/media
/admin/comments
/admin/newsletter
/admin/analytics
/admin/trash
/admin/settings
/admin/log
/admin/help
```

### API (62 routes today, `internal/api`)

The current API exists because Next server components cannot mutate. With a
server-rendered admin, most of these become ordinary form POSTs handled by the page
that owns them. The ones that must stay JSON are those called from JavaScript:

- media upload / register / delete / unused, file upload / attach / delete
- comments moderation (inline table actions)
- search index, search
- track (analytics beacon)
- subscribe, newsletter confirm / unsubscribe / open pixel
- mcp, mcp/authorize, mcp/register, mcp/token, mcp/tokens
- health, cron
- backup connect / restore
- preview-link, revisions

Estimated JSON surface after the fold: **around 25 endpoints**, down from 62.

## Concurrency model

- One HTTP server, `net/http` with `ServeMux` (Go 1.22+ pattern matching is enough;
  no third-party router needed).
- One SQLite writer connection, one read pool.
- One analytics flush goroutine.
- One ticker goroutine for scheduled publishing, media variant sweeps, MCP code
  expiry, and litestream health.
- `context.Context` threaded from request to query, so a client disconnect cancels work.

No job queue, no worker pool, no external cron. The current `api/cron` endpoint stays
only as a manual trigger for debugging.

## File size and style rules

Carried from the old repo, adapted:

- 400 lines per file maximum, enforced by a check in CI.
- No bare `interface{}` / `any`. Use concrete types or constrained generics.
- Every handler logs its request with timing and recovers from panics.
- Errors wrap with `%w` and carry context; no bare `return err` at package boundaries.
- Comments explain **why**, never **what**. Same standard as the current repo, which
  is unusually good about this.
