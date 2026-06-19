@AGENTS.md

# vibeblog — operating notes

Public, open-source blog platform. **Zero personal data in this repo.** Real
credentials + personal notes live in a separate private repo (see README).

## Architecture
- No database. All content is in Vercel Blob.
  - `posts/_index.json` — array of post metadata (no body); the only query layer.
  - `posts/{slug}.md` — YAML frontmatter + markdown body.
  - `media/_index.json` — array of MediaItem.
  - `media/{timestamp}-{name}` — uploaded files (original name preserved).
  - `pages/_index.json` — static pages metadata.
  - `pages/{slug}.md` — static page content.
  - `settings/site.json` — site-wide settings (title, theme, menu…).
- Every write/delete updates the relevant `_index.json` (read → modify → write).
- `src/lib` is the data layer; `src/app/api` are thin route handlers; UI is in
  `src/components`.

## Blob access — `src/lib/blob.ts`
- **Never call `resolveUrl` / `list()` to find a URL before reading.** URLs are
  deterministic: `blobUrl(pathname)` constructs them directly from the token.
  Token format: `vercel_blob_rw_<storeId>_<secret>` →
  `https://<storeId>.public.blob.vercel-storage.com/<pathname>`.
- `readJson(pathname, fallback)` — fetch JSON; returns fallback on 404/error.
- `readText(pathname)` — fetch markdown; returns null on 404/error.
- `writeJson` / `writeText` — put with `allowOverwrite: true`, `cacheControlMaxAge: 0`.
- Every read uses `fresh(url)` (adds `?ts=<now>`) to bust CDN cache on stale blobs.

## Caching model — Previous model (no `cacheComponents`)
`cacheComponents` is NOT enabled. Uses `unstable_cache` + `React.cache()`:

| Function | How cached | Tag |
|---|---|---|
| `getSettings()` | `unstable_cache` | `settings` |
| `getPublicPosts()` | `unstable_cache` | `posts` |
| `getPublicPages()` | `unstable_cache` | `pages` |
| `getPost(slug)` | `React.cache()` | — |
| `getPage(slug)` | `React.cache()` | — |

- **After any post write/delete**: call `revalidateTag('posts', { expire: 0 })` +
  `revalidatePath('/new-slug')` (and old slug if it changed).
- **After settings save**: call `revalidateTag('settings', { expire: 0 })` +
  `revalidatePath('/', 'layout')`.
- **After page write/delete**: call `revalidateTag('pages', { expire: 0 })` +
  `revalidatePath('/slug')` (and old slug if changed).
- `{ expire: 0 }` = immediate expiration (correct for admin writes). Never use 1-arg
  `revalidateTag(tag)` — TypeScript error in Next.js 16 (signature requires 2 args).
- **DO NOT** add `cacheComponents: true` to `next.config.ts` — it enables PPR which
  is incompatible with `React.cache()`, `Date.now()`, and route segment configs.

## ISR — `src/app/(blog)/[slug]/page.tsx`
- `generateStaticParams` + `dynamicParams = true`: all known slugs are attempted at
  deploy, new slugs render on-demand (ISR). In practice, because `readText` uses
  `cacheControlMaxAge: 0` fetches, Next.js falls back all slug routes to dynamic (`ƒ`)
  — but `generateStaticParams` is kept for forward-compat if fetch caching improves.
- List pages (home, category, tag) are dynamic because they access `searchParams`.
- `unstable_cache` still provides cross-request caching for list data even though
  detail pages are dynamic.

## Data layer reference — `src/lib/`

| File | Key exports | Notes |
|---|---|---|
| `blob.ts` | `blobUrl`, `readJson`, `readText`, `writeJson`, `writeText`, `uploadFile`, `deleteByUrl`, `deleteByPathname`, `listBlobs` | All Blob I/O. Never call `list()` to find a URL — use `blobUrl()` |
| `posts.ts` | `getIndex`, `getPublicPosts`, `getPost`, `savePost`, `deletePost`, `getCategories`, `getTags` | `getPublicPosts` = `unstable_cache`; `getPost` = `React.cache()` |
| `pages.ts` | `getPageIndex`, `getPublicPages`, `getPage`, `savePage`, `deletePage` | Mirrors posts.ts; `getPublicPages` = `unstable_cache`; `getPage` = `React.cache()` |
| `settings.ts` | `getSettings`, `saveSettings`, `DEFAULT_SETTINGS`, `DEFAULT_THEME`, `themeToCss` | `getSettings` = `unstable_cache`; `themeToCss` converts ThemeSettings → CSS vars string |
| `media.ts` | `getMedia`, `addMedia`, `deleteMedia` | Raster images auto-converted to WebP ≤1600px on upload; SVG/GIF pass through |
| `auth.ts` | `handlers`, `auth`, `signIn`, `signOut`, `isAuthorized`, `getAuthState` | Anyone can sign in; only `AUTHORIZED_EMAIL` is authorized; unauthorized = silently redirected |
| `slugs.ts` | `ensureSlugFree`, `SlugConflictError` | Posts + pages share the same URL namespace; throws `SlugConflictError` (→ 409) on collision |
| `video.ts` | `videoEmbed`, `isVideoUrl` | Recognizes YouTube / Vimeo / TikTok URLs; returns embed URL. Videos stored as plain URLs in Markdown |
| `paginate.ts` | `paginate`, `parsePage` | Pure helper; `parsePage` converts `searchParams.page` → number |
| `i18n.ts` | `t(lang)`, `formatDate` | Public-site strings (vi/en); admin UI always Vietnamese (`admin-i18n.ts`) |
| `utils.ts` | `slugify`, `deriveExcerpt`, `clampExcerpt`, `isPublicallyVisible`, `formatBytes`, `formatDateVi`, `formatDateTimeShort`, `formatTime` | `isPublicallyVisible` = `status === 'published'` AND date is past |
| `api.ts` | `ok`, `fail`, `logRequest`, `logError`, `requireOwner` | Shared API helpers. Every route must call `requireOwner()` first |
| `admin-i18n.ts` | `adminT(lang)` | ~388 lines of admin string keys; near the 400-line cap — do not add |

## Scripts — `scripts/`

One-off Node scripts, not part of the app. Run with `node scripts/<name>.mjs`.

| Script | Purpose |
|---|---|
| `import-wordpress.mjs` | Import WP XML export → Blob posts |
| `convert-html-to-markdown.mjs` | Convert WP HTML body → Markdown |
| `fix-import-captions.mjs` | Fold `<figcaption>` into image `alt` |
| `backfill-excerpts.mjs` | Auto-fill missing excerpts from body |
| `rehost-images.mjs` | Re-upload external image URLs to Blob |
| `rebuild-index.mjs` | Rebuild `posts/_index.json` + `media/_index.json` from Blob files (recovery tool) |

## Conventions
- UI text (labels, buttons, toasts, placeholders) → Vietnamese.
- Code, comments, identifiers, filenames, commits → English.
- Max 400 lines per file. No `any` (use `unknown` + narrowing).
- No hardcoded Vietnamese strings in `lib/` or `api/` — components only.
- Every API handler: time + log the request, try/catch with logged errors.
- Auth: only `AUTHORIZED_EMAIL` reaches `/admin`; all write/delete routes are
  owner-gated server-side (401 otherwise).

## Next.js 16 reminders
- `params` / `searchParams` are async (await them).
- Use `PageProps<...>` / `RouteContext<...>` global type helpers.
- `unstable_cache` still works (deprecated but not removed); `'use cache'` requires
  `cacheComponents: true` which enables PPR — avoid unless the whole app is PPR-ready.
- `revalidateTag(tag, profile)` requires 2 args. Use `{ expire: 0 }` for immediate
  invalidation or `'max'` for stale-while-revalidate. `revalidateTag('tag')` = TS error.
- `cacheComponents: true` bans `dynamic`, `dynamicParams`, `revalidate` route segment
  configs AND `Date.now()` / `new Date()` in server components without Suspense.
- Before writing any unfamiliar API, read `node_modules/next/dist/docs/`.
