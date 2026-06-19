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

## Media
- [ ] Image upload works, appears in media library immediately
- [ ] Post publish works, appears on blog immediately

## Verify auth quickly

```bash
# All should return {"success":false,"error":"Unauthorized"} with 401
curl -s -X POST   localhost:3000/api/posts            -d '{}'
curl -s -X PUT    localhost:3000/api/posts/test       -d '{}'
curl -s -X DELETE localhost:3000/api/posts/test
curl -s -X POST   localhost:3000/api/media/upload
curl -s -X DELETE "localhost:3000/api/media/by?url=x"
```

## Caching gotchas
- Do NOT add `cacheComponents: true` to `next.config.ts` — it enables PPR which
  breaks `React.cache()`, `Date.now()`, `dynamicParams`, and route segment configs.
- `revalidateTag(tag)` (1-arg) causes TS errors in Next.js 16.
  Always use `revalidateTag(tag, { expire: 0 })` for immediate invalidation.
- `unstable_cache` is deprecated but still works; do not replace with `'use cache'`
  without also doing a full PPR migration.
- In local dev, `unstable_cache` may behave differently from production (no persistent
  cache between restarts). Test cache invalidation after `npm run build && npm start`.
