# Pre-deploy Checklist

- [ ] No file exceeds 400 lines
- [ ] `npm run build` passes clean
- [ ] `npm run lint` passes clean
- [ ] No TypeScript errors
- [ ] All write/delete API routes return 401 when unauthenticated
- [ ] Draft posts not visible on public blog
- [ ] Future-dated posts hidden until the date is reached
- [ ] Past-date posts show the correct date
- [ ] Image upload works, appears in media library immediately
- [ ] Post publish works, appears on blog immediately
- [ ] `_index.json` stays consistent after every write/delete

## Verify auth quickly

```bash
# All should return {"success":false,"error":"Unauthorized"} with 401
curl -s -X POST   localhost:3000/api/posts            -d '{}'
curl -s -X PUT    localhost:3000/api/posts/test       -d '{}'
curl -s -X DELETE localhost:3000/api/posts/test
curl -s -X POST   localhost:3000/api/media/upload
curl -s -X DELETE "localhost:3000/api/media/by?url=x"
```
