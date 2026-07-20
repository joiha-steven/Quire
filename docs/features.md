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
- **Purge-in-use guard:** a media `purge`/`empty` first checks `usedMediaKeys()` (posts + pages +
  revisions + settings); if any target image is still referenced it returns `in_use:<n>` (409) and
  `TrashView` re-asks with a stronger confirm, retrying with `force:true`. Stops a purge silently
  breaking a live page.
- Per kind the lib exports `restoreX`, `purgeX` (hard delete: row + revisions/blobs),
  `getTrashedX`, `emptyXTrash`. The Trash page server-loads all four lists; `TrashView` (4 tabs)
  acts via **`POST /api/trash`** `{ kind, action: restore|purge|empty, ids? }` (owner-gated) then
  `router.refresh()`. **Nothing auto-purges** — permanent removal is manual (per-item or Empty
  trash). Restores revalidate the item's surfaces; media/file purges `revalidateEverything()`.
- Adding a mutating trash action → log it (activity actions `*.restore` / `*.purge` /
  `trash.empty`) and keep the i18n keys in sync.

## Reading & discovery

- Features `{ search, toc, related, readingTime, progressBar, activityLog, sidebar, leadPost,
  categoryLabel, deck, bookText, infiniteScroll }` (all default on EXCEPT `bookText` and `infiniteScroll`,
  which are off; Admin → Settings → Tính năng); gated in header / `/search` / post page. `bookText` =
  book-page typesetting on the post body (first-line indent + justify ≥600px).
- **Sidebar** (`sidebar`): the MAIN (listing) sidebar has two layouts, chosen by `settings.sidebarLayout`
  (**Settings → Site → Layout & menu**): `single` (default) = one left rail with every block stacked
  (full-width column); `two` = **TWO gutter rails on desktop** flanking a narrower reading column
  (listing column = 80% of the post width, via `--shell-w`; the extra compactness pulls both rails in) —
  the two-rail geometry/CSS is emitted ONLY in this mode. **Left rail** = discovery: **most viewed** (auto: top
  `settings.mostViewedCount` public posts by all-time views — default 3, `0` hides it —
  `getViewTotals()` joined to `getPublicPosts()`) + **featured** (owner-curated `settings.featured`
  slugs, in order, first 5, dropped when a slug stops being public). **Right rail** = navigation:
  **menu** (`SidebarMenu`, moved out of the header) + **categories** (a condensed wrapped cloud with
  post counts in parentheses — `CategoryCloud`, `getPublicTaxonomy()`) + **tags** (`TagCloud`). On
  **mobile** there is ONE gutter-less drawer: the left rail is hidden and its two blocks
  are duplicated into the right rail's drawer (`.drawer-only`), giving the order menu → most viewed →
  featured → categories → tags. Assembled in `ListingSidebar` (two `<Rail className="rail-left|rail-right">`
  reusing `IndexBlock`/`CategoryCloud`/`TagCloud`); the geometry (per-page breakpoint + column width + right-rail mirror)
  is injected from `lib/rail-css.ts` (`singleRailCss` for the layout's default/post ToC rail,
  `listingRailCss` for the two rails — the latter uses higher-specificity `.rail.rail-left|right` so it
  wins without ordering games). Each block self-hides when empty. **Post/page reading views show ONLY the
  `toc`** in a single left rail (full width; the free right gutter stays for wide images). Below the rail
  breakpoint the drawer opens from the **header menu button** (`RailToggle`, mobile only; self-hides on
  pages with no rail) — no separate header dropdown. Menu + most-viewed count + featured are edited in
  **Admin → Settings → Site → Layout & menu**; `getViewTotals` uses a GET rpc so the pages stay ISR.
- **Infinite scroll** (`infiniteScroll`, off by default): on every listing (home / category / tag) the
  feed reveals posts on scroll instead of paginating, and a **date timeline** fills the right gutter. The
  whole published list is handed to the `InfiniteListing` client island as light metadata (no bodies), so
  revealing more is pure client work — no network; the first `postsPerPage` chunk still server-renders for
  SEO, and `/page/[n]` URLs 404 (would be duplicate content). The left rail is forced to its single-rail
  branch (all blocks stacked); the right gutter holds a **date timeline** — but NOT a boxed widget: a spine
  runs the full height of the feed (`.post-list::after`) and the FIRST card of each month/year carries a
  **marker** (`.tl-mark` = a dot on the spine + the label — bold year with an accent dot at a year boundary,
  a quiet month name otherwise) absolutely positioned out in the gutter, so the dates line up with the posts
  on the left and scroll with the page — **no JS, no measurement** (the marker is a child of its card,
  `PostCard`'s `mark` prop; geometry from `timelineCss`). No post counts, no click nav. **Desktop only**:
  below the rail breakpoint there is no gutter, so markers + spine are `display:none`; the **grid view** also
  hides them (2-column cards can't align to a single spine). The `reveal` card easing is pure CSS so appended
  cards animate for free.
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
  nothing otherwise). When the post MIXES levels (H2 + H3), top-level rows get `.rail-lead` (a bigger
  `•` dot marker via `::before`) and child rows get `.rail-sub` (smaller, no dot) — so it reads as a
  few big markers over quieter children; the dot is inline so it flows for both rail orientations. An
  all-H2 or all-H3 ToC stays uniform. In the gutter rail the ToC is sticky (`.rail-inner`); `railCss`
  caps it to the viewport with `overflow-y:auto`, so a ToC longer than the screen scrolls inside its own
  box instead of pinning its tail off-screen (the drawer already scrolls via `.rail`). Header: clickable **"Tiêu đề"** (`tocTitle`) that scrolls to top when there
  ARE headings, else a plain non-clickable **"Mục lục"** (`tocIndex`). One line under it joins the
  present tags/categories/comments labels (comments prefixed with their server-rendered count) and
  jumps to the first existing section via `TOC_ANCHORS` + `scroll-mt-24` targets. Collapsible on
  every viewport — pinned in the desktop gutter, and on mobile it shares the sidebar drawer (opened
  from the header menu button `RailToggle`), outside-tap/Escape-dismissable. Solid `bg-bg`;
  `PostContent` assigns slug ids. Phones get wider side gutters (`px-8 sm:px-5`) for the reading text.
- **GOTCHA:** the global unlayered `hr { margin:0 }` beats Tailwind margin utilities — put
  divider spacing on a wrapper div, not on the `<hr>`.
- **Heading ids are de-duped** (2nd `foo` → `foo-2`): `dedupeHeadingIds` (PostContent) and
  `extractHeadings` (utils) run the SAME counter over H2/H3 in document order — change one, change
  both or the ToC anchors break.
- **Link hrefs are sanitized** (`safeHref` in PostContent drops `javascript:`/`data:`/`vbscript:`)
  — marked v5+ no longer does. Raw HTML in markdown is already escaped (the `html` renderer →
  `escapeHtml`), so `<script>`/`<img onerror>` render as visible text.
- **Draft preview:** `/preview/[slug]?key=<hmac>` (force-dynamic + `fetchCache='force-no-store'`
  so it's never stale, noindex); `previewToken` = HMAC(slug, `AUTH_SECRET`). The editor's
  "Preview draft" button saves pending edits first, then opens the URL in a new tab. Separate
  route keeps `/[slug]` SSG + published-only.

## Editor (Admin → editor) — `components/admin/Editor.tsx`

- StarterKit + underline, inline code, bullet/numbered/**task** lists (GFM `- [ ]`), quote,
  code block, hr, link, captioned image, GFM tables, video. `tiptap-markdown` serializes all.
- **Menus live in `EditorMenus.tsx`** (Toolbar + BubbleBar). The editor sets
  `shouldRerenderOnTransaction: true` — TipTap 3 disables it by default, which leaves every
  `isActive()` (toolbar highlights, the table-tools row) stale until an unrelated re-render.
- **Writing shell:** the title grows instead of clipping; the editor header and document frame share
  one bounded gutter; the toolbar is sticky, vertically centred, never wraps, and scrolls horizontally
  on narrow screens. Icon actions keep localized accessible names. Focusing prose must not draw a
  black outline around the document.
- **Optional typewriter feedback:** `settings.motion.typewriter` enables the block caret, subtle
  insert/delete response, and a synthesized filtered-noise key click (45% internal volume; no audio
  file). It ignores composition, modifier/navigation keys, paste, and held repeats. The master
  `settings.motion.enabled` and `prefers-reduced-motion` still gate the visual feedback; disabling
  typewriter feedback makes the editor standard and silent.
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

## Library: Videos tab + self-hosted video — `VideoLibrary.tsx`, `lib/video.ts`

- The Library page has THREE tabs (`LibraryTabs.tsx`): **Images** (media library),
  **Videos**, **Files**. Videos are ordinary attachments in the shared `files` store
  (same upload route `/api/files/attach`, same soft-delete) — `isVideoAttachment`
  (MIME `video/*`, extension fallback) splits them between the Videos tab (grid of
  native `<video controls preload="metadata">` players + copy URL) and the Files tab.
  No schema change; `FileUploader` takes `accept`/`label` for the video dropzone.
- **Publishing:** copy the video URL and paste it on its own line in the editor —
  content stays 100% Markdown, exactly like YouTube/Vimeo/TikTok. The renderer
  (`PostContent buildVideos`) turns a platform URL into an iframe embed and a DIRECT
  file URL (`videoFileUrl`: http(s)/root-relative + `.mp4/.m4v/.webm/.mov`) into a
  native `<video>` (`.video-file`, column width, natural aspect). The scheme gate
  means `javascript:`/`data:` can never reach `src`. The editor's Video node previews
  both forms.
- **Serving (`app/uploads/[...path]`): STREAMS from disk and honours byte ranges.**
  Video seeking — and iOS Safari playback at all — needs 206 responses; the route
  parses `Range` via `lib/http-range.ts` (pinned by `http-range.test.ts`) and pipes
  `createReadStream` into the Response, so a large video never sits in server memory
  (this also de-buffered image serving). `lib/mime.ts` maps video/audio extensions —
  without them the fallback octet-stream makes browsers download instead of play.
- **Host limits:** the reverse proxy caps upload size (nginx `client_max_body_size`),
  and proxies/CDNs (e.g. Cloudflare free: 100 MB) cap request bodies — a huge video
  fails at the edge, not in the app. For long/heavy video, a platform embed
  (unlisted YouTube/Vimeo) is still the better tool: transcoding + adaptive bitrate.

## Admin UI kit — `components/admin/kit.tsx`

- ONE source of truth for shared admin chrome so no page hand-rolls its own (radius /
  padding / shadow / header size used to drift): `Card` (canonical `CARD` surface),
  `PageHeader` (the title block every screen reuses — was a copy-pasted `<h1>`),
  `Tabs` (`underline` for Settings + `segment` for Content/Analytics, one component),
  `StatCard`, `EmptyState`, and table tokens (`TableFrame` / `THEAD` / `TROW`). Admin is
  monochrome by design — the kit uses the neutral scale, not public theme tokens.
- **Admin canvas:** `<main>` in the admin layout carries `.admin-canvas` (globals.css) — a flat,
  quiet neutral surface (one fill per light/dark mode); the sidebar + cards sit on solid surfaces
  above it. (The editorial redesign replaced the old dotted-grid canvas — see
  `docs/admin-redesign-2026-07.md`.)
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

## Activity log + Overview (Admin)

- **Activity log:** every mutating route does `after(() => logActivity(action, detail))`
  (post/page CRUD, media/file/icon/font, settings, taxonomy, cache.clear, backup.*). Gated by
  `features.activityLog`. Admin → Log (force-dynamic, latest 200, Clear). **Adding a mutating
  route → log it too.**
- **Error log (same table):** `logError` (`lib/api.ts`) — called from every route catch — also
  schedules `after(() => logActivityError("METHOD /path", message))`, recording an `error`-action
  entry (gated by the same toggle). So unexpected server failures show up in the log, rendered with
  a red badge in `ActivityLog.tsx`. Only genuine errors land here (validation 400s use `fail()`, not
  `logError`).
- **Overview (`Overview.tsx`):** the admin home. A header with a **New post** action, five **stat
  cards** — Posts / Pages / Comments / Images / Storage (each links to its section; Comments = sum of
  `countsByPosts()` when comments are on) — then the **dashboard widgets** (`DashboardWidgets.tsx`): a
  **Traffic** card (30-day views + visitors with an inline sparkline + last-7-days, from
  `getAnalytics(30)`), **Most viewed** (top 5 posts/pages by all-time views, `getViewTotals` mapped to
  titles), and **Needs attention** (**draft count only** — unused-media is deliberately excluded, too
  heavy to compute per load; no "pending comments" — comments publish on submit). Below that a **Recent
  activity** list (latest few from `getActivity`, gated by `features.activityLog`, "view all" → Log) and
  a one-line **system footer** — DB reachability · storage · a **View site** link, from `getSystemInfo()`.
- **The editorial redesign** removed the old home-page duplicate cards (SEO health, traffic sources,
  quick-actions row, taxonomy breakdown, and the rich system panel) — that data lives on its own pages
  now; only the compact footer remains. See `docs/admin-redesign-2026-07.md`. (`admin/page.tsx` still
  passes the `seo`/`sources` props, now unused by `Overview`.)
- **Help / Guide:** Admin → Help (`/admin/help`, `HelpGuide.tsx`) — a concise, sectioned index (writing,
  settings, self-host, Cloudflare, cache/ops, MCP) linking out to the repo docs. **Content is English by
  design** (canonical, like the docs); only the nav label + title are localized (`navHelp`). Pure server
  component, no client JS. Add a section here (not a new i18n dump) when a subsystem needs owner guidance.
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
  **Content** `FeatureFields`/`CommentFields`+`CommentKeys`; **Appearance** `ThemeFields`/`FontFields`
  (built-in `fontPreset` picker + `chromeFont` selector)/`FontUpload`/`TypographyFields`/`AdvancedFields`
  (Rendering card: font smoothing + the **Motion** engine toggle → `settings.motion.enabled` + the
  editor **Typewriter feedback** option → `settings.motion.typewriter`) + custom-CSS; **SEO**
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
