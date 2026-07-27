# Module structure, caching, concurrency

Replaces `go/docs/02-packages.md`.

## Layout

```
v2/
  package.json
  src/
    index.ts              boot: env check, schema apply, Hono app, listen
    server/
      app.ts              Hono instance, middleware chain, router groups
      owner.ts            the owner-gated router group (Invariant 4)
      errors.ts           typed error pages + logging with timing
      cache.ts            the whole cache (see below)
    content/              posts, pages, revisions, slugs, taxonomy, series, scheduled
    media/                media, files, blob, image variants (sharp)
    render/               markdown (marked), footnotes, toc, video, inline-md, og
    comments/             tree, tombstones, markdown subset, notify
    news/                 subscribers, mail, broadcast, send log, email builders
    analytics/            record, aggregate, timezone buckets, ua buckets
    auth/                 password, TOTP, sessions, recovery codes (06-auth.md)
    mcp/                  MCP server, tokens, OAuth DCR
    store/
      db.ts               the two connections + PRAGMAs
      schema.sql          embedded, applied at boot
      migrations/
    api/                  61 route handlers, one file per resource
    web/                  public routes + Hono JSX views
    i18n/                 6 locales, moved verbatim from src/locales
    cli/                  import-v1, db inspect, user set-password
  admin/                  the React SPA, moved from src/components/admin
  assets/
    css/                  hand-written public.css (no Tailwind)
    js/                   core.js, post.js, listing.js + lazy chunks
  golden/
  docs/
```

## Mapping from `src/lib`

The rule: **anything that does not touch `db()` moves verbatim.** That is 42 of 65
files, about 6,500 lines. It keeps its tests.

| Current | Destination | Change |
|---|---|---|
| `footnotes` `toc` `video` `inline-md` `comment-tree` `series-order` `paginate` `taxonomy` `ua` `utils` `slugs` `image` `mime` `cdn` `safe-fetch` `settings-sanitize` `redirect-path` `og` `preview` `wordpress-import` `themes` `email-brand` `newsletter-email` `comment-md` | same-named file under the matching folder | **none** |
| `db.ts` | `store/db.ts` | rewritten: `@supabase/postgrest-js` to `bun:sqlite`. 132 call sites across 28 files follow |
| `posts` `pages` `revisions` `media` `files` `settings` `comments` `subscribers` `newsletter-log` `analytics` `activity` `redirects` `series` `integration-keys` `backup-state` | matching folder | query bodies rewritten, signatures and semantics unchanged |
| `revalidate.ts` | `server/cache.ts` | collapses to one function, see below |
| `api.ts` | `server/errors.ts` + `server/owner.ts` | `requireOwner()` becomes router-group membership |
| `auth.ts` `auth-shared.ts` | `auth/` | rewritten, see 06-auth.md |
| `gdrive.ts` `backup.ts` | deleted / reduced | litestream replaces the Drive path (parity exception #1) |
| `highlight.ts` | `render/highlight.ts` | **runs at save time** into the content-addressed `render_cache` (01-schema.md §4); the read path looks up and self-heals on a miss |
| `rate-limit.ts` | `server/rate-limit.ts` | unchanged, extended for login (06-auth.md) |

## Caching: the biggest simplification

Today: ISR page cache plus a tagged Data Cache plus `lib/revalidate.ts` computing a
`revalidatePath` superset per write, pinned by a test because it is easy to
under-purge.

In Quire 2.0 it is one in-process `Map` of rendered HTML, and **every write clears all
of it**:

```ts
export const cache = new Map<string, CachedPage>()
export function clearCache() { cache.clear() }   // called after every write, unconditionally
```

Invariant 1 becomes structurally unbreakable rather than test-enforced. Re-rendering a
post from SQLite costs well under a millisecond, so a total flush is not a performance
question at this scale. Cloudflare stays in front and is purged the same way, totally.

**Do not reintroduce targeted invalidation.** If a future measurement shows the flush
matters, add a rollup or a longer edge TTL, not a dependency graph.

## Concurrency

Single-threaded event loop, and this removes an entire class of design work the Go plan
needed:

- `bun:sqlite` is **synchronous**. A query does not yield, so no request can observe a
  half-applied transaction and no mutex is needed anywhere.
- There is exactly one writer by construction. No `SQLITE_BUSY` queue to build.
- Analytics writes buffer in an array and flush on `setInterval` every 2 seconds or at
  200 rows, whichever comes first, in one transaction against `analytics.db`. This is
  Invariant 7 and it is the only deferred write in the system.
- Long CPU work (image variants via `sharp`, OG rendering via `satori`) must not run on
  the event loop. Both are already async and offloaded by their libraries; the deferred
  `-1024` / `-1600` variant generation keeps its cron sweep.

## Route mapping

**Public (`src/web`, Hono JSX):** `/`, `/page/:n`, `/:slug`, `/category/:slug`
(+`/page/:n`), `/tag/:slug` (+`/page/:n`), `/series/:slug`, `/search`, `/preview/:slug`,
`/feed.xml`, `/sitemap.xml`, `/sitemaps.xml`, `/robots.txt`, `/llms.txt`,
`/manifest.webmanifest`, `/og`, `/uploads/*`, `/.well-known/*`, `/api/md/:slug`.

**Admin (`admin/`):** one route, `/admin/*`, serving the embedded SPA shell. Routing
inside it stays client-side. 14 pages, unchanged.

**API (`src/api`):** the 61 existing routes, same paths, same shapes. Split into two
router groups:

- **public**: `track`, `search`, `subscribe`, `comments` (POST), `newsletter/open`,
  `newsletter/unsubscribe`, `mcp/*`, `health`
- **owner-gated**: everything else, mounted under a group that runs the session check
  once (Invariant 4). A new route is owner-gated by default; making it public is an
  explicit act, which is the opposite of today's `isPublicApi()` allowlist and safer.

`ownerRouter()` (`src/web/guard.ts`) applies the gate AT CONSTRUCTION, so there is no
router someone can create and then forget to guard. The CSRF origin check lives inside
that same middleware rather than beside it: a cookie-authenticated write is exactly the
request that needs both, and splitting them creates the possibility of mounting one
without the other.

`bun run check:routes` (`scripts/checks/routes-guarded.ts`) is the enforcement. It fails
the build on any POST/PUT/PATCH/DELETE registered outside a gated router, unless its path
appears in that script's `PUBLIC_WRITES` map WITH the reason it is public. Making the
exception a list entry that carries an argument is the point; a naming convention would
not be one. It caught a forgotten `/api/auth/enrol/done` the first time it ran.

## Invariants carried over

1. **Cache is cleared completely after every write.** `clearCache()`, unconditional.
2. **Posts and pages share one `/{slug}` namespace.** `ensureSlugFree` on create and
   rename; trashed rows still reserve their slug.
3. **Image refs are stored store-relative.** `collapseBlob` on write, `expandBlob` on
   read, in the data layer only.
4. **Write routes are owner-gated by router-group membership**, not by a per-handler
   check.
5. **Raw HTML in markdown is escaped, never executed.** `marked` with the existing
   `html` renderer override plus `safeHref`. Unchanged code, unchanged test.
6. **Every delete is a soft delete.** One `liveOnly` SQL fragment shared by every live
   read.
7. **Analytics writes go through the flush buffer**, never straight to a request handler.

Each has a test that fails if it is weakened, and the test must be updated in the same
commit, which makes the weakening visible.

## File size and style rules

Same as the frozen tree, because they worked: **400 lines per file maximum**, no `any`
(use `unknown` and narrow), every handler times and logs its request, errors wrap with
context, comments explain why rather than what.

English for code, comments, identifiers, filenames, commits and docs. Vietnamese only in
`src/i18n` locale data and user-facing strings.
