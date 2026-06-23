# Comprehensive audit — 2026-06-23

- **Version:** 1.1.5 (main @ `cc2ed53`)
- **Scope:** whole project, focus on the two batches since the last audit (0.9.0): the Docker
  self-host work (v1.1.2 storage driver, v1.1.3 bundled Postgres+PostgREST, v1.1.4 stack hardening)
  and the comments IP/country column (v1.1.5, #51).
- **Verdict:** clean. No security vulnerabilities or logic bugs. The three real defects in the Docker
  subsystem were already found by the live boot test and fixed in v1.1.4 (see CHANGELOG); this pass
  found nothing further to fix. One non-blocking privacy follow-up logged for the new commenter IP.

## 0. Baseline
- `npm run check:all` → exit 0 (tsc + lint + check:routes/filesize/no-any/no-direct-blob/token-bust + 91 tests)
- `npm run build` → exit 0; `/` + `/[slug]` render `○`/`●` (ISR), admin `ƒ` (dynamic), `/uploads/[...path]` `ƒ`
- (live) full `docker compose` stack booted: service_role SELECT 200 / INSERT 201, anon write 401

## 1. Security — pass
- New write routes gated: `/api/media/upload` + `/api/files/attach` both call `requireOwner()` first
  (codified by `check:routes`); they sit under the `/api/:path*` middleware net and are NOT in
  `isPublicApi()`, so non-owners are blocked at the edge too.
- `/uploads/[...path]` is a PUBLIC GET by design (serves public assets, same role Vercel Blob's
  public URLs play). Path traversal is blocked: `read()` → `resolveSafe()` does `path.resolve(DIR, p)`
  and rejects anything not under `DIR` (`..` escapes 404). The route is outside the middleware matcher
  (`/admin`, `/api` only) — correct for a public asset.
- Storage facade containment: only `blob.ts` imports `@vercel/blob`, only the client-upload files
  import `@vercel/blob/client` — codified by the new `check:no-direct-blob`.
- Bundled-DB boundary verified live: `anon` (no JWT) cannot read or write (401); `service_role`
  (BYPASSRLS, JWT-signed) is the only authenticated role, mirroring Supabase. PostgREST connects on
  an unexposed internal port; the JWT secret is per-install (`gen-keys.mjs`).
- OG `?font=` SSRF guard still bounded: fetches only the Vercel Blob host OR the request's own origin
  (the local driver serves fonts from same-origin `/uploads`) — no arbitrary/internal fetch.
- `files/attach` accepts any content type (octet-stream fallback) — unchanged, intentional: the
  attachment library is catch-all, matching the existing `/api/files/blob-token` + register path.
- **Comments IP/country (#51):** captured commenter `author_ip` (`x-forwarded-for[0]`) +
  `author_country` (`x-vercel-ip-country`) are PII but **admin-only** — `PUBLIC_COLS` excludes
  `author_ip`/`author_email`/`author_country`, so the public comment tree (`getCommentTree`,
  `addComment` return) never selects or returns them; only `ADMIN_COLS` (owner-gated routes) does.
  Confirmed the public `Comments.tsx` reads only the signed-in viewer's own email, no others' IP.

## 2. Logic — pass
- The only data-layer code change (`db.ts`) is env-gated: `POSTGREST_DIRECT` strips the `/rest/v1`
  prefix ONLY when set (Docker). Unset on Vercel → exact prior behaviour. Store-relative image-ref
  invariant intact (`blob.test.ts` green); backup reads blobs via the driver (`readBlob`) so a
  snapshot works under either backend.
- Soft-delete, slug namespace, revalidate-superset invariants untouched (their seam tests pass).
  Postgres init applies `scripts/schema.sql` (single source) + roles/grants; restore still strips
  `id`/`search`.

## 3. Performance — pass
- `/uploads/[...path]` streams from disk with `Cache-Control: immutable` (content-stable names), so
  repeat hits are browser/CDN-cached. `listBlobs` on the local driver walks the dir — `O(files)`,
  same intent as the Blob driver, used only by stats/backup.
- No public page made `force-dynamic`; ISR intact. Docker runner now has a writable `.next/cache`.

## 4. Code quality — pass
- New files all well under the 400-line cap: `blob-local.ts` 65, `mime.ts` 15, the two upload routes
  51/40, `/uploads` route 26, `gen-keys.mjs` 36. No `any`, no stray `console.log`/`TODO`/`@ts-ignore`
  (codified). `check:no-direct-blob` added to `check:all`.

## 5. Layout / visual — N/A
- No UI component changes this batch (work was infra + `db.ts`/`og.ts`/`blob.ts` libs + docs). No new
  hardcoded colours/sizes; shared class constants untouched.

## 6. i18n — pass
- Docker batch: no UI strings added (API error codes only). Comments batch (#51): the admin "From"
  → "IP" column rename updated all 6 admin locales (de/en/ja/ko/vi/zh) + `types.ts` together, per
  the invariant. 6 locales remain key-complete (tsc `satisfies`).

## 7. Docs — pass
- README (3rd install path + env table), ARCHITECTURE (storage-driver + bundled-DB *why*), CLAUDE
  (env + data-layer map + DEBUG ROUTER), CHANGELOG, ROADMAP (Phases 1–2 shipped), CHECKLIST (Docker
  section), docs/backups all updated across the batch.
- No personal/instance data in tracked files: `git ls-files` shows no `.env*`/`data/`; the throwaway
  test `.env.docker` + `./data` were removed; `.gitignore` covers `.env*` (templates excepted).

## Changes shipped this pass
- `audit/2026-06-23-comprehensive.md` (this report). No code fixes — the batch audited clean.

## Follow-ups (none blocking)
- **Privacy (commenter IP, #51):** `author_ip` is stored in PLAINTEXT (unlike analytics, which salts
  + hashes IP and stores no raw address). It is admin-only and deliberate (spam/abuse moderation),
  but there is no retention/purge — like analytics, it is kept forever. Owner may want to document
  this (privacy note) or add a retention policy; a future option is to hash/truncate it. Not a leak,
  not blocking — flagged for an owner decision.
- Roadmap items, not defects: an S3/MinIO storage driver and a GHCR-published multi-arch image
  (so Synology/NAS can pull instead of build). Tracked in ROADMAP Phases 1–2.
