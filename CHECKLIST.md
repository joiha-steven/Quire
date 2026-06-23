# Pre-deploy Checklist

## Code
- [ ] No file exceeds 400 lines
- [ ] `npm run build` passes clean
- [ ] `npm run lint` passes clean
- [ ] No TypeScript errors (`npx tsc --noEmit`)

## Auth
- [ ] All write/delete API routes return 401 when unauthenticated (see curl below)
- [ ] `/admin` inaccessible to unauthenticated users

## Content correctness
- [ ] Draft posts not visible on public blog
- [ ] Future-dated posts hidden until the date is reached
- [ ] Past-date posts show the correct date
- [ ] Postgres rows stay consistent after every write/delete (posts/pages/media/files)
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set in the target Vercel environment
- [ ] Deleting a media item moves it to Trash (it leaves the library but is NOT gone — the
  blob + every variant stay until purged from Trash)

## Cache & ISR
- [ ] After publishing a post: detail page at `/{slug}` shows the new post
- [ ] After publishing a post: home page list updates (may need one refresh for ISR)
- [ ] After saving settings: header/title/theme updates on next page load
- [ ] Editing a post slug: old slug returns 404, new slug works
- [ ] Deleting a post: slug returns 404, removed from home list
- [ ] `BLOB_READ_WRITE_TOKEN` format is `vercel_blob_rw_<storeId>_<secret>` —
  `blobUrl()` will throw at runtime if the token is malformed or missing

## Pagination (path-based)
- [ ] Home `/page/2` works; `/page/1` and out-of-range `/page/999` return 404
- [ ] `/category/<x>/page/2` and `/tag/<x>/page/2` work; page links carry no `?query`
- [ ] Blog list shows reading time when the readingTime feature is on

## Media
- [ ] Uploading several images at once: ALL appear (no dropped entries)
- [ ] Re-uploading a same-named file creates `name-2`, never errors
- [ ] Dragging image(s) into the editor inserts every one, in order
- [ ] Image upload works, appears in media library immediately (original + thumb)
- [ ] An inserted image ALWAYS shows on the post (even before variants exist — it falls
  back to a plain `<img>` of the original; `<picture>` only appears once variants exist)
- [ ] On save, jpg/png get `-1024`/`-1600` AVIF+WebP variants; post renders `<picture>`
- [ ] Browser is served AVIF where supported (DevTools → Network on a post)
- [ ] "Check unused" badges media referenced by no post/page/settings/revision (read-only,
  deletes nothing); the "show unused only" filter appears when any are found
- [ ] Deleting an image moves it to Trash (blob kept); **purging** it from Trash removes the
  original + thumbnail + every variant
- [ ] Favicon / app icon upload accepts `.ico` and lands in `files/` (not the media grid)
- [ ] Post publish works, appears on blog immediately

## Trash (soft delete)
- [ ] Deleting a post/page/media/file moves it to Admin → Trash; it leaves the live site/library
- [ ] Restore returns the item to live (post/page reappears on its URL + lists)
- [ ] "Delete permanently" / "Empty trash" purges (posts: row+revisions; media/files: row+blobs)
- [ ] Nothing in Trash disappears on its own (no auto-purge)
- [ ] A published post linking a trashed image still renders that image (blob kept until purge)

## MCP server (optional)
- [ ] MCP toggle OFF (Admin → Settings → Advanced) → `GET /api/mcp` returns 401
- [ ] Generate a token: shown once, appears in the list (name + prefix), max 5 enforced, delete works
- [ ] With the toggle ON, a `Authorization: Bearer <token>` MCP client lists/creates/updates posts
- [ ] `update_settings` only changes title/description/showDescription (sensitive settings refused)
- [ ] `/.well-known/oauth-protected-resource` + `/.well-known/oauth-authorization-server` return JSON

## Backups (Google Drive, optional)
- [ ] One-time: Google Drive API enabled on the `AUTH_GOOGLE_ID` Cloud project + `https://<domain>/api/backup/callback` added as an Authorized redirect URI
- [ ] "Connect Google Drive" → consent → returns to Settings → Advanced showing **connected**
- [ ] "Back up now" creates a `.tar.gz` in the Drive `vibeblog-backups` folder; it appears in the list with a size
- [ ] The refresh token never appears in the client: `GET /api/settings` / page source has no Drive token (only enabled/interval/keep)
- [ ] Retention: with N snapshots > `keep`, a new run prunes to the newest `keep`
- [ ] Restore (on a throwaway/staging site) replaces content from the snapshot; a pre-restore snapshot is created first
- [ ] Toggle OFF (or disconnect) → the cron no longer creates snapshots

## Docker self-host (only when shipping the image)
- [ ] `docker compose up -d --build` boots; the image builds with **no backend env** (data layer
  degrades to empty), then runs with `.env.docker` supplied
- [ ] `STORAGE_DRIVER=local`: uploading an image writes under the `/app/uploads` volume and renders
  at `/uploads/...` (original + thumb + variants); it survives `docker compose down && up`
- [ ] Large upload (>4.5 MB) succeeds — the browser posts to `/api/media/upload` (no serverless cap)
- [ ] Deleting then purging media removes the files from the volume (no orphaned binaries)
- [ ] The cron sidecar reaches `/api/cron` hourly with the `CRON_SECRET` bearer (keep-alive + sweep)
- [ ] Backup "Back up now" produces a `.tar.gz` whose `blob/` holds the volume's files (driver read)
- [ ] OG card: a post's featured image + custom font load (absolute `<SITE_URL>/uploads/...` URLs)
- [ ] The Vercel deploy is unaffected: no `STORAGE_DRIVER` set there → still Vercel Blob

## Admin nav (collapsible left sidebar)
- [ ] Desktop: sticky left sidebar with icons; active route highlighted; controls pinned at the bottom
- [ ] Collapse toggle → icon-only rail; state persists across navigation (localStorage); tooltips show
- [ ] Mobile: hamburger opens a drawer with the same links + controls (always icon+label)
- [ ] Settings + editor save bars sit to the right of the sidebar (not under it) at any collapse state

## Layout / visual (owner is very sensitive here)
- [ ] Header rows align on one line: every item (incl. the wordmark) is an `h-9`/`h-10`
  `items-center` box; the row is `items-center` (never `items-baseline`)
- [ ] Sibling controls share ONE class constant — admin bar `ADMIN_NAV`
  (`components/admin/headerActions.ts`), public icon buttons `ICON_BTN`
  (`components/ui/iconButton.ts`); grep the literal class string to catch a new hand-rolled copy
- [ ] Public reading UI uses theme tokens only (`bg-bg`/`text-text`/`text-meta`/`border-rule`…),
  no hardcoded `neutral-*`/hex/`white`/`black`
- [ ] One `<hr>` divider style (global 50% left rule); no bespoke `border-t` dividers; no `uppercase`
- [ ] Palette switch + light/dark/system/by-time both apply instantly with no FOUC on reload

## Typography (per-role system)
- [ ] No hardcoded font sizes on the PUBLIC site: `grep -rE "text-\[|text-(xs|sm|base|lg|xl|[2-6]xl)\b"
  src/components/blog 'src/app/(blog)'` returns only the brand wordmark (`text-lg`) + 404 numeral
  (`text-6xl`); everything else uses `.fs-h*` / `.t-small` / `.prose` role vars
- [ ] `globals.css :root` `--fs-*/--lh-*/--ls-*` defaults EXACTLY mirror `DEFAULT_TYPOGRAPHY`
  in `lib/themes.ts` (fresh install must match a saved-default site)
- [ ] Settings → Appearance → text sizes: editing a role updates the public site after save +
  reload; "reset to default" returns to the tuned scale
- [ ] List-card titles (H2) read as headings, not banners; single-post/page/category titles (H1) step up
- [ ] One typeface everywhere on the reading site — code blocks render in the site font, not monospace
- [ ] Custom font: uploading per weight (400/500/600/700) registers `@font-face`; bold/headings render
  with the real weight (faux-bold is disabled); removing all weights falls back to Inter

## Verify auth quickly

```bash
# All should return {"success":false,"error":"Unauthorized"} with 401
curl -s -X POST   localhost:3000/api/posts            -d '{}'
curl -s -X PUT    localhost:3000/api/posts/test       -d '{}'
curl -s -X DELETE localhost:3000/api/posts/test
curl -s -X POST   localhost:3000/api/media/upload
curl -s -X DELETE "localhost:3000/api/media/by?url=x"
curl -s -X POST   localhost:3000/api/files/upload
curl -s            localhost:3000/api/media/unused   # GET, owner-only audit
```

## Caching gotchas
- Model = ISR pages + full purge on save. After an admin save, a plain reload of the
  public page must show the change (the save calls `revalidatePath('/', 'layout')`).
- `npm run build` should show `/` and `/[slug]` as `○`/`●` (ISR), admin as `ƒ` (dynamic).
  If `/[slug]` is `ƒ`, the Blob reads got set to `no-store` again (that breaks ISR).
- Do NOT add `unstable_cache` back or `cacheComponents: true`. Do NOT set `blob.ts` reads
  to `cache: 'no-store'` — keep `{ next: { revalidate } }` so pages stay ISR-eligible.
- The "Clear all cache" button must purge + warm (returns `{ warmed }`).
- Change blog settings (e.g. background color) → reload public site shows it immediately.
