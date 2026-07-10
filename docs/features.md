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

- Features `{ search, toc, related, readingTime, progressBar, activityLog, sidebar, leadPost,
  categoryLabel, deck }` (default on, Admin → Settings → Tính năng); gated in header / `/search` /
  post page.
- **Sidebar** (`sidebar`): categories (with published-post counts) + tags in the left gutter of the
  home list, from `getPublicTaxonomy()`. `toc` puts a post's headings in that same gutter. Both are
  `<Rail>`; below the rail breakpoint the same markup becomes a slide-out drawer opened by a small
  edge handle.
- **Lead post** (`leadPost`): the newest post on home page 1 takes the `h1` role, the rest stay `h2`.
  Sizes come from the type roles, so the display size is an Admin → Appearance setting, not CSS.
- **Category label** (`categoryLabel`) and **standfirst** (`deck`, the excerpt under a post title).
- `/search` — **two layers:** a lean local index (`{slug,title,date,terms}`, instant +
  accent-insensitive) merged with `GET /api/search?q=` (Postgres FTS over title + BODY via
  `searchPosts` `.textSearch('search', …, {config:'simple'})`). **NOTE:** `simple` is accent-
  *sensitive* — accent-insensitivity comes from the local layer only. Header search =
  `SearchOverlay` (modal); the `/search` route stays for deep links / no-JS.
- Post page: `ReadingProgress`, `BackToTop`, `Toc`, `RelatedPosts` (`getRelatedPosts`: shared
  tags ×2 + categories). Blog routes show a themed skeleton while loading (`(blog)/loading.tsx` +
  `.skeleton`, motion-engine-gated).
- `Toc` shows whenever a post has headings OR an in-page jump (`showToc` in the page; renders
  nothing otherwise). Header: clickable **"Tiêu đề"** (`tocTitle`) that scrolls to top when there
  ARE headings, else a plain non-clickable **"Mục lục"** (`tocIndex`). One line under it joins the
  present tags/categories/comments labels (comments prefixed with their server-rendered count) and
  jumps to the first existing section via `TOC_ANCHORS` + `scroll-mt-24` targets. Collapsible on
  every viewport from a text-free left-edge handle — default open + pinned on desktop (xl+), default
  closed + outside-tap/Escape-dismissable on mobile. Solid `bg-bg`; `PostContent` assigns slug ids.
  Phones get wider side gutters (`px-8 sm:px-5`) so the handle clears the text.
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
- **Menus live in `EditorMenus.tsx`** (Toolbar + BubbleBar). The editor sets
  `shouldRerenderOnTransaction: true` — TipTap 3 disables it by default, which leaves every
  `isActive()` (toolbar highlights, the table-tools row) stale until an unrelated re-render.
- **BubbleBar:** a floating `BubbleMenu` (`@tiptap/react/menus`) over a text selection or with the
  cursor in a link — bold/italic/underline/strike/code + link edit/remove. `shouldShow` skips node
  selections (image/video) so it never covers their own controls.
- **Tables:** insert is a 3×3 with a header row; a contextual toolbar row (shown only when the
  cursor is in a table) adds/removes columns + rows or deletes the table. The header row + left
  column are shaded with `--c-rule` (the table's own border colour) as a visual spine — the
  left-column shade is CSS-only (GFM has no header-column), so it never changes the saved Markdown.
  **GOTCHA:** list items wrap content in `<p>`; `.prose li > p{margin:0}` keeps them tight.
- **Local (offline) autosave** (`useLocalDraft.ts`): unsaved edits are stashed in `localStorage`
  every 8s while dirty — NEVER to the server, so editing a *published* post can't push
  half-finished text live; only Save/Publish writes to the server. On return, a snapshot that
  outlived its session (crash / closed tab / dropped connection clears nothing) surfaces a
  "restore / discard" bar; a successful server save clears it. `beforeunload` still warns.
- Gallery insert adds all picked images in ONE `insertContent` (a per-image loop leaves only the
  last — `setImage` selects the node it inserts, so the next insert replaces it).
- Time machine: each overwrite snapshots the prior version (`revisions.ts`, keeps 3); restore
  loads it into the editor (non-destructive — current version is snapshotted on next save).

## Admin UI kit — `components/admin/kit.tsx`

- ONE source of truth for shared admin chrome so no page hand-rolls its own (radius /
  padding / shadow / header size used to drift): `Card` (canonical `CARD` surface),
  `PageHeader` (the title block every screen reuses — was a copy-pasted `<h1>`),
  `Tabs` (`underline` for Settings + `segment` for Content/Analytics, one component),
  `StatCard`, `EmptyState`, and table tokens (`TableFrame` / `THEAD` / `TROW`). Admin is
  monochrome by design — the kit uses the neutral scale, not public theme tokens.
- **Dotted canvas:** `<main>` in the admin layout carries `.admin-canvas` (globals.css) —
  a CSS radial-gradient dot grid (fixed faint neutral per light/dark mode); the sidebar +
  cards float on solid surfaces above it.
- **Sidebar (`AdminSidebar`):** the collapse/expand control sits at the TOP next to the
  wordmark (a compact chrome button, NOT a nav row) so it can't be mistaken for Sign out;
  Sign out sits alone in the footer under its own divider. Palette selection was REMOVED
  from the admin chrome — it lives on the public site now; the admin only toggles light/dark.

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
- **Error log (same table):** `logError` (`lib/api.ts`) — called from every route catch — also
  schedules `after(() => logActivityError("METHOD /path", message))`, recording an `error`-action
  entry (gated by the same toggle). So unexpected server failures show up in the log, rendered with
  a red badge in `ActivityLog.tsx`. Only genuine errors land here (validation 400s use `fail()`, not
  `logError`).
- **Overview (`Overview.tsx`):** stat cards — **Posts / Pages / Comments / Images / Storage**
  (each links to its section; Comments = sum of `countsByPosts()` when comments are on) — then the
  **dashboard widgets** (`DashboardWidgets.tsx`): a **Traffic** card (30-day views + visitors with an
  inline sparkline + last-7-days, from `getAnalytics(30)`), **Most viewed** (top 5 posts/pages by
  all-time views, `getViewTotals` mapped to titles), and **Needs attention** (draft + unused-media
  counts; no "pending comments" — comments publish on submit, there is no moderation queue). Then a
  **Quick actions** row, a **Recent activity** card (latest 6 from `getActivity`, gated by
  `features.activityLog`), taxonomy breakdown, and the System panel at the bottom.
- **System panel** (`getSystemInfo()`): hosting/URL/env/git + database
  (Postgres, live reachability) + storage host + **MCP on/off** + **Backups on** (= enabled AND Drive
  connected); rows may deep-link. The Images card splits media into **originals / variants / files**
  (variants = blobs matching `-(thumb|NNNN).(avif|webp)`); category/tag cards show their total count.
- **Analytics:** Admin → Analytics (24h/7d/30d/1y); a View column on the content tables
  (`getViewTotals`). Shows total views + unique visitors (with **period-over-period trend** and a
  **new-vs-returning** split), avg read depth, a daily bar series, **top pages by title** (a
  labelled Page/Views/Visitors/Depth table), and **top referrers + countries** (counted by
  **distinct visitor**, one person = 1 — not page views), plus a **CSV export** of the daily series. The trend / new-returning /
  referrer / country sections need the `analytics-deepening` migration
  (`scripts/migrations/2026-06-25-analytics-deepening.sql`); until it is applied the data layer falls
  back to the base shape and those sections stay hidden. Detail in the data-layer map (`analytics.ts`).

## Settings (Admin → settings) — `SettingsView.tsx`

- **ONE form, ONE save button, FIVE task-based tabs** (`site | content | appearance | seo |
  integrations`; tab state not persisted, but `?tab=` deep-links — the Drive-connect redirect lands
  on `integrations`). One `useState<SiteSettings>` → one PUT `/api/settings`.
- **Footer is owner-editable** (Site tab, under Layout): `settings.footer` is limited inline markdown
  (`lib/inline-md.ts` — **bold / italic / underline / link** only, escape-first like `comment-md`,
  link hrefs protocol-checked) authored via `FooterField` (textarea + B/I/U/Link toolbar + live
  preview). `{year}`/`{title}` tokens expand at render. The public layout renders it in `<footer
  class="site-footer">`; default keeps the "© {year} {title} · powered by Quire Blog" line.
- Controlled field groups (no own state/save), per tab: **Site** `SiteFields`/`LayoutMenuFields`;
  **Content** `FeatureFields`/`CommentFields`+`CommentKeys`; **Appearance** `ThemeFields`/`FontUpload`/
  `TypographyFields`/`AdvancedFields` (Rendering card: font smoothing + the **Motion** engine
  toggle → `settings.motion.enabled`) + custom-CSS; **SEO**
  `SeoFields`; **Integrations** `BackupFields` + `McpFields` + `CloudflareFields` + `ImportFields`
  (WordPress import — see below). `McpFields` is the EXCEPTION to "no own
  state/save": the MCP enable toggle flows through the settings form, but its token manager has its
  own `/api/mcp/tokens` API (plaintext shown once).
- **Palette is FRONTEND-ONLY now** — the admin chrome no longer carries a `PaletteToggle` (only the
  light/dark toggle). The Appearance tab still sets the site's **default palette** + which palettes
  readers may switch between (`settings.enabledPalettes`), with a note (`themeAdminNote`) explaining
  this. The DEFAULT palette (`themePreset`) is always shown (its checkbox is locked) so the set is
  never empty. `enabledPaletteOptions()` filters the public `PaletteToggle` (renders `null` when ≤1
  option). The no-FOUC script ignores a stored palette that is no longer enabled (falls back to the
  default). Disabled palettes stay fully editable — visibility ≠ customization. Sanitizer
  (`sanitizeEnabledPalettes`): known ids only, preset order, default forced in; a missing field
  (legacy settings) = all on. Pinned by `settings-sanitize.test.ts`.
- Tabs lay cards out `grid lg:grid-cols-2 items-start` (explicit columns, NOT CSS `columns`).
- **Save calls `router.refresh()`** so the admin shell + public header reflect the change
  immediately.

## Comments — `lib/comments.ts`, `components/blog/Comments.tsx`

Text-only reader comments, **off by default** (`settings.comments.enabled`). Identity is either
manual (name + email + optional website, optionally behind Cloudflare Turnstile) or a signed-in
Google account.

- **Instant, never cached — by design.** The post page stays ISR/static; the comment block is a
  CLIENT island (`Comments.tsx`; the composer + sign-in buttons live in `CommentForm.tsx`) that
  fetches `/api/comments?post=<slug>` with `no-store`. The route sets `fetchCache = 'force-no-store'`
  so its DB read is LIVE. A new comment is POSTed and shown **optimistically** — rendered with the
  SAME `renderCommentMarkdown` the server uses (no content drift) and overlaid via
  `mergeOptimisticComments` (`lib/comment-tree.ts`, tested) — then an authoritative REFETCH replaces
  it and clears the overlay (a failed POST removes the optimistic comment + shows the error). **No
  `revalidatePath` ever runs for a comment.** The live count comes from the same fetch + overlay.
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
- **Admin:** `/admin/comments` lists live comments (content/post/time/name/IP/delete); the content
  cell is clamped to two lines and click-toggles to the full text per row (replies are flat rows, so
  each toggles on its own). The IP column shows the captured commenter IP with the ISO country code
  in parens (`1.2.3.4 (VN)`) — country is best-effort from the reverse proxy / Cloudflare edge
  header, blank when absent, and pre-feature rows show `—`. Delete = soft delete via owner-gated
  `DELETE /api/comments/[id]` → Trash (restore/purge in `TrashView`'s Comments tab). `/admin/content`
  posts table gains a comment-count column when enabled (`countsByPosts`).
- **Abuse:** manual comments only accept a published, visible post + a per-IP in-memory rate limit
  (6/min). The same IP (+ country) is persisted on the row (`author_ip`/`author_country`) for admin
  moderation — admin-only, NEVER sent to the public comment tree.
- **Integration keys live in the ADMIN, not (just) env (`lib/integration-keys.ts`).** Turnstile
  keys are SECRETS, kept in the server-only `integration_keys` table (single row), set via
  Admin → Settings (`CommentKeys.tsx` → owner-gated `POST /api/comments/keys`) — NEVER in
  `settings.data`. An env var of the same name is a fallback. `getCommentEnv()` (async) reports which
  integrations are usable (booleans) + the public Turnstile site key. Google stays env-only (it's
  also the owner's admin sign-in — putting it in the admin would deadlock the owner's own login).
- **Cloudflare Turnstile (`lib/turnstile.ts`, `Turnstile.tsx`).** Toggle `settings.comments.turnstile`;
  **enforced only when the toggle is on AND a Turnstile secret exists**, so toggling on without keys
  never locks out commenting (the admin row shows a "needs keys" badge + the key inputs appear right
  below). The manual form gates the comment box **behind the Turnstile pass**; the POST verifies the
  token server-side via siteverify (fail closed). Tokens are single-use → the form re-arms after each post.
- **Google login (`auth.ts`).** Toggles `settings.comments.googleAuth`.
  NextAuth config is a FUNCTION so the provider reads keys at runtime: Google from env. This runs
  in Node only — the **edge middleware reads
  the JWT directly via `getToken`** (`auth-shared.ts` holds the pure `isAuthorized`), so the
  database client never enters the edge bundle. The session carries `name` + `provider` (`next-auth.d.ts`
  augments `Session`/`JWT`). The island resolves the viewer client-side via `/api/auth/session` (the
  post page is static): signed in → "Commenting as …" + a plain box (no name/email/Turnstile); else
  sign-in buttons (`signIn` from `next-auth/react`). The POST **trusts the session** (`getCommenter()`)
  for a logged-in commenter. A signed-in commenter is NOT an admin — `isAuthorized` still gates
  `/admin` to `AUTHORIZED_EMAIL` only.
- **Routes:** `/api/comments` (GET list + POST create) is the ONLY public-exempt comment path
  (middleware + `check:routes`); `/api/comments/[id]` DELETE stays owner-gated.

## WordPress import — `lib/wordpress-import.ts`, Admin → Settings → Integrations

- **One-click import** from a WordPress export (`Tools → Export → All content` = a WXR `.xml`).
  `ImportFields` uploads the file (multipart) to owner-gated `POST /api/import/wordpress`.
- **`parseWxr(xml, now)` is PURE** (no I/O; unit-tested in `wordpress-import.test.ts`): each `item`
  with `wp:post_type` post/page and a live status → a post/page. HTML `content:encoded` → Markdown
  (`turndown` + GFM), `<figure><figcaption>` folded INTO the image alt (Quire renders captions from
  alt). Categories/tags split by `@_domain`, `Uncategorized` dropped; dates via `wp:post_date_gmt`;
  status `publish`→`published` else `draft`; excerpt from `excerpt:encoded` or `deriveExcerpt`.
- **The route persists** via `savePost`/`savePage` — new content is ADDED, a slug that collides with
  existing content gets a numeric suffix (nothing overwritten). One `revalidateEverything()` at the
  end; logged as `import.wordpress`. **Images keep their source URLs** (not rehosted).
- `turndown`/`turndown-plugin-gfm`/`fast-xml-parser` are runtime deps; turndown is in
  `serverExternalPackages` (its Node DOM shim). Max upload 100MB; non-WXR files are rejected.
