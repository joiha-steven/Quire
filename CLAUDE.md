@AGENTS.md

# Quire Blog — router

> ## FROZEN — this tree accepts security patches only
>
> Quire 2.0 is being built in [`v2/`](./v2/) as a single **Bun + Hono + SQLite** executable,
> at full feature parity, and will replace this implementation.
> Plan: [`v2/docs/00-plan.md`](./v2/docs/00-plan.md) · Decision: [ADR 0005](./docs/decisions/0005-rewrite-in-bun-hono-sqlite.md).
> (`go/` was the previous plan and is [superseded](./go/SUPERSEDED.md). Do not build from it.)
>
> **This file's rules apply to `src/` only.** Work inside `v2/` follows
> [`v2/CLAUDE.md`](./v2/CLAUDE.md) instead.
>
> Rules for `src/` from 2026-07-26 ([ADR 0003](./docs/decisions/0003-freeze-v1-rewrite-as-v2.md)):
> - Security patches only. No new features, no refactors, no dependency bumps beyond CVEs.
> - Version stays at **1.5.0**. Do not bump.
> - Deploy path is unchanged (`rsync src/`, bump `.deployment-id`, build, restart).
> - Read it freely when porting behaviour to v2. Do not edit it for that purpose.
> - **One agreed exception (M0), already shipped:** font axes, the CSS split, and
>   Speculation Rules. See [`docs/performance.md`](./docs/performance.md).

Public, open-source blog platform. **Zero personal data in this repo.** Real credentials
live only in the gitignored `.env.local` (native) or `.env.docker` (Docker); never commit
them. Personal and instance facts are not tracked in git.

## This file is a ROUTER. It restates nothing.

One rule lives in exactly one file, because two copies means one is wrong within a month.
Capped at 170 lines and held there by `check:docs`, since it loads every turn.

| Looking for | Go to |
|---|---|
| The mental model, the *why* | [`ARCHITECTURE.md`](./ARCHITECTURE.md) |
| Load-bearing rules you must not break | [`docs/invariants.md`](./docs/invariants.md) |
| `src/lib` map, caching contract, render path | [`docs/data-layer.md`](./docs/data-layer.md) |
| Typography, layout, i18n, releases | [`docs/conventions.md`](./docs/conventions.md) |
| What a feature does, per area | [`docs/features.md`](./docs/features.md) |
| Fonts, CSS, island JS, prerender rule | [`docs/performance.md`](./docs/performance.md) |
| SEO, feeds, OG, PWA · MCP · backups · self-host | [`docs/seo-pwa.md`](./docs/seo-pwa.md) · [`docs/mcp.md`](./docs/mcp.md) · [`docs/backups.md`](./docs/backups.md) · [`docs/self-host-native.md`](./docs/self-host-native.md) |
| Agent discovery, markdown negotiation | [`docs/agent-ready.md`](./docs/agent-ready.md) |
| Admin visual contract | [`docs/admin-design.md`](./docs/admin-design.md) |
| **Why was this decided, does it still hold** | [`docs/decisions/`](./docs/decisions/README.md) |
| Roadmap, tasks, open questions, worklog | [`state/`](./state/README.md) |
| DB schema | [`scripts/schema.sql`](./scripts/schema.sql) |

Anything dated is a snapshot and lives in `state/audits/` or `state/reports/`, which are
**write-only**: never retro-edited, never swept for current context.

## Working principles

Bias toward caution over speed; for trivial changes, use judgment.

**1. Think before coding.** State assumptions. If two readings are possible, present both
rather than picking silently. If a simpler approach exists, say so and push back when
warranted. If something is unclear, stop, name what is confusing, and ask.

**2. Simplicity first.** The minimum code that solves the problem. No speculative
abstractions, no flexibility nobody asked for, no error handling for impossible states. If
200 lines could be 50, rewrite it.

**3. Surgical changes.** Touch only what the task requires. Do not "improve" adjacent code,
comments or formatting. Match the existing style even if you would do it differently.
Remove only what YOUR change orphaned; mention pre-existing dead code rather than deleting
it. **Mandatory exception:** when behaviour changes, update the matching doc in the SAME
change. That is part of the request, not scope creep.

**4. Definition of Done: `npm run check:all` exits 0.** Typecheck, lint, the static guards
(`check:routes` / `filesize` / `no-any` / `no-direct-blob` / `token-bust` / `docs`) and the
test seams. No "it compiles" exception. Behaviour not covered by `check:all` gets a test in
the same commit. A release batch also runs `npm run build`, the `state/audits/` procedure,
and the manual checks a script cannot do. Suspect media/blob drift? Run
`npm run check:consistency:live` BEFORE reading code.

**5. RUN what you changed and LOOK at it. Never test against production.** `check:all`
proves the code compiles and the seams hold. It cannot tell you the subscriber email column
collapsed to `reader@e…`, or that a picker was still labelled for one item after becoming
multi-select. Both shipped, because nobody opened the page.
- **Stack:** `docker compose -f docker-compose.dev.yml up -d` then `npm run dev`. Sign in
  with `DEV_LOGIN` ([`CONTRIBUTING.md`](./CONTRIBUTING.md)) — no Google credentials needed,
  so there is no excuse for an unseen admin change.
- **Drive it with headless Chromium.** Navigate, click, screenshot, read the DOM, measure.
  Do NOT reason about rendered CSS from source, and do NOT ask the human for screenshots.
- **Email is testable.** Mailpit at <http://localhost:8025> runs the whole newsletter path.
- ⚠ **The dev database's `settings` row differs from production.** Anything depending on it
  (font preset, language, palette, feature flags) is read off the box, not from a local build.
- **Production is not a test environment.** A newsletter cannot be unsent.

## DEBUG ROUTER — when you hit a symptom, read THESE files first

| Symptom / area | Read these first | Read more if needed |
|---|---|---|
| Image: upload / variant / responsive | `lib/media.ts`, `lib/blob.ts` (+ `lib/blob-local.ts`, `app/uploads/[...path]`), `lib/upload-client.ts`, `api/media/*`, `components/blog/PostContent.tsx` | `lib/media-usage.ts` |
| Cache / stale / content not updating / ISR | `lib/revalidate.ts`, `lib/db.ts`, `lib/posts.ts` | ARCHITECTURE "Request flow" |
| Auth / route 401 / route exposed / can't sign in locally | `lib/auth.ts` (+ `lib/auth-shared.ts` = edge-safe `isAuthorized`; `devLoginEnabled` = the LOCAL-ONLY owner sign-in, double-gated on `NODE_ENV !== 'production'` + a `DEV_LOGIN` secret, with `src/env.ts` refusing to boot production while it is set — pinned by `lib/dev-login.test.ts`, never weaken it), `lib/api.ts`, `src/middleware.ts` (JWT via `getToken`, NO `db()` client), `api/<route>/route.ts` | `CONTRIBUTING.md` "Getting set up", `docs/mcp.md` if MCP |
| Redirect not firing / 301 wrong / old URL 404s | `lib/redirects.ts`, `src/middleware.ts` (redirect map, edge-safe fetch), `lib/redirect-path.ts` (`normalizePath`), `api/redirects` | `docs/features.md` "URL redirects" |
| Newsletter / subscribe / opt-in / SMTP not sending / test send | `lib/subscribers.ts`, `lib/mail.ts` (Nodemailer; config on `integration_keys`; EVERY send logged), `lib/newsletter-log.ts`, `api/subscribe`, `api/newsletter/*`, `api/mail` (+ `api/mail/test`), `components/admin/NewsletterFields.tsx` (SMTP creds only), `components/blog/Subscribe{Form,Trigger,Overlay}.tsx` | `docs/features.md` "Newsletter" |
| Broadcast not sent / re-sent / open rate / reply notify | `lib/broadcast.ts` (`broadcastPost` — MANUAL only, no cron send), `api/broadcast`, `src/app/admin/newsletter`, `components/admin/Newsletter{View,Subscribers,Send,Test}.tsx`, `lib/newsletter-log.ts` + `api/newsletter/open` (pixel), `lib/comment-notify.ts`, `lib/newsletter-email.ts` | `docs/features.md` "Newsletter" |
| Slug / 404 / duplicate URL | `lib/slugs.ts`, `src/app/(blog)/[slug]` | `lib/posts.ts`, `lib/pages.ts` |
| Trash / soft delete / restore | `lib/posts.ts` (`deleted_at`), `api/trash`, `src/app/admin/trash` | `docs/features.md` |
| Comments (reader) / not showing / cache | `lib/comments.ts`, `components/blog/Comments.tsx`, `api/comments`, `lib/comment-md.ts` | `docs/features.md` "Comments" |
| Backup / restore / cron | `docs/backups.md`, `lib/backup.ts`, `lib/gdrive.ts`, `lib/backup-state.ts` | — |
| Scheduled post not going live / on time | `lib/scheduled.ts` (`sweepScheduled`/`newlyLive`), `api/cron` (`?publish=1`), `lib/utils.ts` (`isScheduled`/`isPublicallyVisible`) | `docs/features.md` "Scheduled publishing" |
| Theme / palette / dark / FOUC | `lib/themes.ts`, `src/components/theme/*` | `docs/conventions.md` |
| Typography / font / layout drift | `docs/conventions.md` FIRST, then the component | — |
| Font preload / CSS size / island JS / LCP / what a reader loads | `docs/performance.md` (the resource-loading law), `lib/themes.ts` (`fontPreloadHrefs`), `src/app/{layout.tsx,globals.css,theme.css,admin/admin.css}` | `docs/conventions.md` |
| Admin chrome / editor toolbar / typewriter feedback | `docs/admin-design.md`, `state/reports/2026-07-13-admin-redesign.md`, `components/admin/Editor.tsx`, `components/admin/EditorMenus.tsx` | `components/admin/kit.tsx`, `docs/features.md` |
| Search / ToC / related / preview | `lib/posts.ts`, `api/search`, `components/blog/PostContent.tsx` | `docs/features.md` |
| Book reading mode / fullscreen 2-column / "Chế độ đọc sách" toggle | `components/blog/BookMode.tsx` (tiny toggle + `#read` wiring; imports `book.css`), `components/blog/BookReader.tsx` (heavy overlay, **lazy** via `next/dynamic`), `components/blog/book.css` (post-route only), `features.bookMode`, `src/app/(blog)/[slug]/page.tsx` (`#post-body` + meta-line toggle) | `docs/features.md` "Book reading mode" |
| Series / collections / `/series/[slug]` / admin Series tab | `lib/series.ts` (`getSeriesForPost`/`resolveSeries`/`updateSeries`/`reorderSeries`) + `lib/series-order.ts` (pure `orderSeries`/`seriesEntries`, client-safe), `components/blog/SeriesBox.tsx`, `components/admin/SeriesManager.tsx`, `api/series`, `src/app/(blog)/series/[slug]` | `docs/features.md` "Series / collections" |
| SEO / sitemap / feed / robots / OG | `docs/seo-pwa.md`, `src/app/{robots,sitemap,llms.txt,feed.xml,og}` | `lib/og.ts` |
| PWA / manifest / favicon | `docs/seo-pwa.md`, `src/app/manifest.ts`, `src/app/layout.tsx` | — |
| MCP server | `docs/mcp.md`, `src/lib/mcp/*`, `src/app/api/mcp/*` | — |
| Agent discovery / markdown negotiation / .well-known / Content-Signal / Link headers | `docs/agent-ready.md`, `lib/well-known.ts`, `src/app/.well-known/*`, `src/app/{auth.md,robots.txt,api/md/[slug]}`, `next.config.ts` | `docs/mcp.md` |
| WordPress import | `lib/wordpress-import.ts` (pure WXR→posts/pages), `api/import/wordpress`, `components/admin/ImportFields.tsx` | `docs/features.md` |
| Admin Help page / in-app manual | `components/admin/HelpGuide.tsx` (shell) + `HelpSections.tsx` + `HelpTables.tsx` + `help-kit.tsx`, `src/app/admin/help` — body is ENGLISH by design (mirrors the repo docs); ADD NEW FEATURES HERE, it is where a non-technical owner learns they exist | `docs/features.md` "Admin Help" |
| Health / env / migrations / rate-limit | `api/health`, `src/env.ts` + `src/instrumentation.ts`, `scripts/migrate.sh` + `scripts/schema.sql` (`schema_migrations`), `lib/rate-limit.ts` | `docs/self-host-native.md` |


## Hard rules

Full detail in [`docs/conventions.md`](./docs/conventions.md); the short form, because
these are the ones broken by accident:

- **Max 400 lines per file. No `any`** (use `unknown` + narrowing).
- Every API handler times and logs its request, try/catch with logged errors, and calls
  `requireOwner()` first if it writes ([invariant 4](./docs/invariants.md)).
- **Public UI colours come ONLY from theme tokens.** Never a hardcoded `neutral-*`, `white`,
  `black` or hex. ONE typeface, no hardcoded sizes, one divider style, never ALL-CAPS.
- UI text → `src/locales/` only, all 6 languages in sync. Code, comments, identifiers,
  filenames, commits and docs → English. No hardcoded Vietnamese in `lib/` or `api/`.
- **Behaviour change → update its doc in the same commit.** Rules to `docs/`, decisions to
  `docs/decisions/` (append-only), what happened to `state/WORKLOG.md`.
- **Do NOT read CHANGELOG.md while coding.** It is append-only at release time and its
  history is never needed to fix or understand code.

## Next.js 16

`params`/`searchParams` are async; use `PageProps<…>`/`RouteContext<…>`. DB-read cache rules
→ [`docs/data-layer.md`](./docs/data-layer.md) (`no-store` + `cacheComponents:true`
forbidden). Unfamiliar API → read `node_modules/next/dist/docs/` (`AGENTS.md`).
