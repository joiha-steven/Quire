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
- [ ] `_index.json` stays consistent after every write/delete

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
- [ ] Deleting an image removes the original + thumbnail + every variant
- [ ] Favicon / app icon upload accepts `.ico` and lands in `files/` (not the media grid)
- [ ] Post publish works, appears on blog immediately

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
