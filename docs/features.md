> Split from CLAUDE.md — read when touching a feature area: Trash, reading/discovery (search, ToC, related, preview), the editor, the content dashboard, activity log + system panel, or settings.

# Feature areas

## Trash (soft delete) — Admin → Trash (`/admin/trash`)

- **Every delete is a soft delete.** `posts`/`pages`/`media`/`files` each have a nullable
  `deleted_at` (NULL = live, timestamp = trashed). `deleteX()` sets `deleted_at`; nothing is
  hard-deleted on a normal delete. EVERY live read filters `.is('deleted_at', null)`
  (index/search/getPost, page index/getPage, media/file lists, the finalize sweeps) so trashed
  items leave the site, lists, search, sitemap/feed/llms and the libraries at once.
- **Media/file soft delete KEEPS the blob** — a published post linking a trashed image keeps
  rendering; the blob is removed only on purge. So `/api/media/delete` no longer purges the page
  cache (it used to). A trashed row **keeps its slug** (still reserved via `ensureSlugFree`) so
  restore never collides.
- Per kind the lib exports `restoreX`, `purgeX` (hard delete: row + revisions/blobs),
  `getTrashedX`, `emptyXTrash`. The Trash page server-loads all four lists; `TrashView` (4 tabs)
  acts via **`POST /api/trash`** `{ kind, action: restore|purge|empty, ids? }` (owner-gated) then
  `router.refresh()`. **Nothing auto-purges** — permanent removal is manual (per-item or Empty
  trash). Restores revalidate the item's surfaces; media/file purges `revalidateEverything()`.
- Adding a mutating trash action → log it (activity actions `*.restore` / `*.purge` /
  `trash.empty`) and keep the i18n keys in sync.

## Reading & discovery

- Features `{ search, toc, related, readingTime, progressBar, activityLog }` (default on,
  Admin → Settings → Tính năng); gated in header / `/search` / post page.
- `/search` — **two layers:** a lean local index (`{slug,title,date,terms}`, instant +
  accent-insensitive) merged with `GET /api/search?q=` (Postgres FTS over title + BODY via
  `searchPosts` `.textSearch('search', …, {config:'simple'})`). **NOTE:** `simple` is accent-
  *sensitive* — accent-insensitivity comes from the local layer only. Header search =
  `SearchOverlay` (modal); the `/search` route stays for deep links / no-JS.
- Post page: `ReadingProgress`, `BackToTop`, `Toc` (≥3 H2/H3; title click scrolls to top;
  under the headings it links to the in-page tags/categories/comments via `TOC_ANCHORS`;
  left-pinned + always visible on desktop, hidden behind a left-edge tab + slide-out on
  mobile; solid `bg-bg` so it never shows content through; `PostContent` assigns slug ids),
  `RelatedPosts` (`getRelatedPosts`: shared tags ×2 + categories).
- **GOTCHA:** the global unlayered `hr { margin:0 }` beats Tailwind margin utilities — put
  divider spacing on a wrapper div, not on the `<hr>`.
- **Heading ids are de-duped** (2nd `foo` → `foo-2`): `dedupeHeadingIds` (PostContent) and
  `extractHeadings` (utils) run the SAME counter over H2/H3 in document order — change one, change
  both or the ToC anchors break.
- **Link hrefs are sanitized** (`safeHref` in PostContent drops `javascript:`/`data:`/`vbscript:`)
  — marked v5+ no longer does. Raw HTML in markdown is already escaped (the `html` renderer →
  `escapeHtml`), so `<script>`/`<img onerror>` render as visible text.
- **Draft preview:** `/preview/[slug]?key=<hmac>` (force-dynamic, noindex);
  `previewToken` = HMAC(slug, `AUTH_SECRET`); editor "Link nháp" button. Separate route keeps
  `/[slug]` SSG + published-only.

## Editor (Admin → editor) — `components/admin/Editor.tsx`

- StarterKit + underline, inline code, bullet/numbered/**task** lists (GFM `- [ ]`), quote,
  code block, hr, link, captioned image, GFM tables, video. `tiptap-markdown` serializes all.
  **GOTCHA:** list items wrap content in `<p>`; `.prose li > p{margin:0}` keeps them tight.
- Autosave every 60s while dirty (chained behind any in-flight save); warns on unload.
- Time machine: each overwrite snapshots the prior version (`revisions.ts`, keeps 3); restore
  loads it into the editor (non-destructive — current version is snapshotted on next save).

## Content dashboard (Admin → content)

- 3 tabs: Bài viết / Trang / Phân loại; "new" hidden on taxonomy.
- `RowActions` (shared): open-in-new (PUBLISHED only) + edit + delete; exports the `ICON_BTN`
  chrome for reuse. `StatusPill` never wraps.
- Tables are mobile-responsive by **hiding secondary columns** (not horizontal scroll): posts
  hide Date (`sm`) + Categories (`md`); pages hide slug (`sm`). Title + Status + actions always show.
- `PostsTable` filter bar: substring search + All/Published/Draft (client-side).
- `TaxonomyManager`: rename (merge) / remove terms across all posts → `updateTerm`.

## Activity log + System panel (Admin)

- **Activity log:** every mutating route does `after(() => logActivity(action, detail))`
  (post/page CRUD, media/file/icon/font, settings, taxonomy, cache.clear, backup.*). Gated by
  `features.activityLog`. Admin → Log (force-dynamic, latest 200, Clear). **Adding a mutating
  route → log it too.**
- **System panel** (admin Overview, `getSystemInfo()`): hosting/URL/region/env/git + database
  (Supabase, live reachability) + Blob host + **MCP on/off** + **Backups on** (= enabled AND Drive
  connected); rows may deep-link. The stat cards split media into **originals / variants / files**
  (variants = blobs matching `-(thumb|NNNN).(avif|webp)`); category/tag cards show their total count.
- **Analytics:** Admin → Analytics (24h/7d/30d/1y); a View column on the content tables
  (`getViewTotals`). Detail in the data-layer map (`analytics.ts`).

## Settings (Admin → settings) — `SettingsView.tsx`

- **ONE form, ONE save button, THREE tabs** (`general | appearance | advanced`; tab state not
  persisted). One `useState<SiteSettings>` → one PUT `/api/settings`.
- Controlled field groups (no own state/save): General `SiteFields`/`LayoutMenuFields`/
  `FeatureFields`/`SeoFields`; Appearance `ThemeFields`/`FontUpload`/`TypographyFields`/
  `AdvancedFields` (font smoothing = "Text rendering"); Advanced `McpFields` + custom-CSS.
  `McpFields` is the EXCEPTION to "no own state/save": the MCP enable toggle flows through the
  settings form, but its token manager has its own `/api/mcp/tokens` API (plaintext shown once).
- **Palette visibility (`ThemeFields` "Shown to visitors").** `settings.enabledPalettes` is the
  allow-list a visitor may switch between; each preset card has a checkbox. The DEFAULT palette
  (`themePreset`) is always shown (its checkbox is locked) so the set is never empty. `enabledPaletteOptions()`
  filters the public + admin `PaletteToggle`; `PaletteToggle` renders `null` when ≤1 option (the
  icon disappears). The no-FOUC script ignores a stored palette that is no longer enabled (falls
  back to the default). Disabled palettes stay fully editable — visibility ≠ customization.
  Sanitizer (`sanitizeEnabledPalettes`): known ids only, preset order, default forced in; a missing
  field (legacy settings) = all on. Pinned by `settings-sanitize.test.ts`.
- Each tab: `grid lg:grid-cols-2 items-start` (explicit columns, NOT CSS `columns`).
- **Save calls `router.refresh()`** so the admin shell + public header reflect the change
  immediately.

## Comments — `lib/comments.ts`, `components/blog/Comments.tsx`

Text-only reader comments, **off by default** (`settings.comments.enabled`). Identity is either
manual (name + email + optional website, optionally behind Cloudflare Turnstile) or a signed-in
Google/Facebook account.

- **Instant, never cached — by design.** The post page stays ISR/static; the comment block is a
  CLIENT island (`Comments.tsx`) that fetches `/api/comments?post=<slug>` with `no-store`. The
  route sets `fetchCache = 'force-no-store'` so its DB read is LIVE. A new comment is POSTed, then
  the island REFETCHES (authoritative, no optimistic reconciliation). **No `revalidatePath` ever
  runs for a comment** — so commenting never touches the ISR/`revalidate.ts` path. The live count
  on the page comes from the same fetch, so it can't go stale.
- **Limited markdown (`comment-md.ts`):** only `**bold**` / `*italic*`. The source is HTML-escaped
  FIRST, then only `<strong>/<em>/<br>` are injected — no user tag, link, image, or script survives
  (mirrors Invariant 5). Hard cap 1000 chars (server + client).
- **3-tier threading.** `depth` (0/1/2) is enforced server-side in `addComment` (a reply needs
  `parent.depth < 2`); display nesting is rebuilt from the actual ancestry. `buildCommentTree`
  (pure, tested) re-roots orphans (parent purged) and renders a deleted-but-still-replied node as a
  blanked **tombstone**; a deleted leaf is pruned.
- **Privacy:** email is stored but NEVER sent to the public client (separate `PUBLIC_COLS` vs
  `ADMIN_COLS`); website gets `rel="nofollow ugc noopener"`.
- **Post rename / purge:** `renameComments` moves comments with the slug; `deleteCommentsForPost`
  clears them when a post is purged (both wired in `posts.ts`).
- **Admin:** `/admin/comments` lists live comments (content/post/time/name/from/delete); delete =
  soft delete via owner-gated `DELETE /api/comments/[id]` → Trash (restore/purge in `TrashView`'s
  Comments tab). `/admin/content` posts table gains a comment-count column when enabled
  (`countsByPosts`).
- **Abuse:** manual comments only accept a published, visible post + a per-IP in-memory rate limit
  (6/min).
- **Integration keys live in the ADMIN, not (just) env (`lib/integration-keys.ts`).** Turnstile +
  Facebook keys are SECRETS, kept in the server-only `integration_keys` table (single row), set via
  Admin → Settings (`CommentKeys.tsx` → owner-gated `POST /api/comments/keys`) — NEVER in
  `settings.data`. An env var of the same name is a fallback. `getCommentEnv()` (async) reports which
  integrations are usable (booleans) + the public Turnstile site key. Google stays env-only (it's
  also the owner's admin sign-in — putting it in the admin would deadlock the owner's own login).
- **Cloudflare Turnstile (`lib/turnstile.ts`, `Turnstile.tsx`).** Toggle `settings.comments.turnstile`;
  **enforced only when the toggle is on AND a Turnstile secret exists**, so toggling on without keys
  never locks out commenting (the admin row shows a "needs keys" badge + the key inputs appear right
  below). The manual form gates the comment box **behind the Turnstile pass**; the POST verifies the
  token server-side via siteverify (fail closed). Tokens are single-use → the form re-arms after each post.
- **Google / Facebook login (`auth.ts`).** Toggles `settings.comments.googleAuth` / `facebookAuth`.
  NextAuth config is a FUNCTION so providers read keys at runtime: Google from env, **Facebook from
  the `integration_keys` table** (env fallback). This runs in Node only — the **edge middleware reads
  the JWT directly via `getToken`** (`auth-shared.ts` holds the pure `isAuthorized`), so the Supabase
  client never enters the edge bundle. The session carries `name` + `provider` (`next-auth.d.ts`
  augments `Session`/`JWT`). The island resolves the viewer client-side via `/api/auth/session` (the
  post page is static): signed in → "Commenting as …" + a plain box (no name/email/Turnstile); else
  sign-in buttons (`signIn` from `next-auth/react`). The POST **trusts the session** (`getCommenter()`)
  for a logged-in commenter. A signed-in commenter is NOT an admin — `isAuthorized` still gates
  `/admin` to `AUTHORIZED_EMAIL` only.
- **Routes:** `/api/comments` (GET list + POST create) is the ONLY public-exempt comment path
  (middleware + `check:routes`); `/api/comments/[id]` DELETE stays owner-gated.
