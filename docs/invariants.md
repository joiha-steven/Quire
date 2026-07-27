> Split from CLAUDE.md. The load-bearing rules: break one and something silently
> breaks in production. Each is enforced in code AND pinned by a test or a static guard,
> all run by `npm run check:all`. A change that weakens one updates its guard in the SAME
> commit, which makes the weakening visible in review.

# Invariants

Each is *Enforced at* code + pinned by a *Test* or static *Guard* — all run by `npm run check:all`.

1. **Revalidate is a SUPERSET — never under-purge.** Every admin write goes through ONE place,
   `lib/revalidate.ts`; each helper runs `freshenData()` (`revalidateTag('db')`) THEN a
   `revalidatePath` superset of what the change touches. *Enforced at:* `lib/revalidate.ts`.
   *Test:* `lib/revalidate.test.ts`.
2. **Posts + pages share ONE `/{slug}` namespace.** Every create/rename calls `ensureSlugFree`
   → 409 `SlugConflictError` on collision (trashed rows still reserve their slug).
   *Enforced at:* `lib/slugs.ts`. *Test:* `lib/slugs.test.ts`.
3. **Image refs are stored store-relative.** `collapseBlob` strips the `/uploads` prefix on WRITE,
   `expandBlob` re-adds it on READ — applied in the data layer only (posts/pages/settings), so stored
   bytes carry no origin. *Enforced at:* `lib/blob.ts` + the data-layer files. *Test:* `lib/blob.test.ts`.
4. **Every write/delete route calls `requireOwner()` first.** `src/middleware.ts` is the edge
   defence-in-depth net (blocks `/admin` + owner-only `/api`); a NEW public/bearer route must be
   added to `isPublicApi()` or it 401s. *Enforced at:* `lib/api.ts` + `src/middleware.ts`.
   *Guard:* `check:routes` (static presence) + the middleware net; no integration test.
5. **Raw HTML in markdown is escaped, never executed.** `html` renderer → `escapeHtml`; `safeHref` drops
   `javascript:`/`data:`/`vbscript:`. *Enforced at:* `PostContent.tsx`. *Test:* `post-content.test.ts`.
6. **Every delete is a soft delete.** `deleteX()` sets `deleted_at`; EVERY live read filters
   `.is('deleted_at', null)` via `liveOnly()` (`db.ts`) — predicate defined ONCE; Trash reads the
   complement. *Enforced at:* data-layer files + `docs/features.md`. *Test:* `lib/soft-delete.test.ts`.
7. **Cache-bust is asymmetric.** Out-of-band writes (`backup_state`) MUST `revalidateTag(DB_TAG)`; MCP
   token routes MUST NOT (`force-no-store`; busting `db` over-purges public). *Enforced at:*
   `lib/backup-state.ts` vs `api/mcp/tokens`. *Test:* `check:token-bust` (backup side = coarse tripwire).

> **Accepted risk — no drift check (2C):** `scripts/schema.sql` is hand-maintained, the app never runs
> it. Any table/RPC/index change MUST update it in the SAME commit — review-enforced (live diff declined).
