# Contributing to Quire

Thanks for helping. Quire values small, correct, well-scoped changes.

## Getting set up

- Node ≥ 20.9 (CI runs 24). `npm ci` to install.
- Self-host locally with Docker (`docker compose up -d --build`) or natively — see
  [`README.md`](./README.md) and [`docs/self-host-native.md`](./docs/self-host-native.md).
- **To actually work on the app**, don't use the production compose (its app container
  is a production build: no hot reload, and the dev sign-in is gated off). Use the
  backing-services stack and run the app yourself:

  ```sh
  cp .env.docker.example .env.docker
  node scripts/docker/gen-keys.mjs >> .env.docker     # DB password + JWT secret + key
  docker compose -f docker-compose.dev.yml up -d      # Postgres + PostgREST + Mailpit
  ```

  Then point `.env.local` at it — `SUPABASE_URL=http://localhost:3001`,
  `POSTGREST_DIRECT=1`, the `SUPABASE_SERVICE_ROLE_KEY` from `.env.docker` — and
  `npm run dev`.
  - **Signing in without Google.** Most machines have no OAuth credentials, which
    would leave `/admin` unreachable. Set `DEV_LOGIN=<any secret>` in `.env.local` and
    a "Developer sign-in (local only)" option appears at `/api/auth/signin`; type that
    secret and you are the owner. It is an auth bypass, so it has two gates and a
    third alarm: the provider is not registered unless `NODE_ENV !== 'production'`, it
    demands the secret rather than being a bare flag, and **a production server
    refuses to boot while `DEV_LOGIN` is set** (`src/env.ts`). Pinned by
    `src/lib/dev-login.test.ts` — do not weaken any of it.
  - **Email.** The dev stack includes Mailpit: point Admin → Settings → Integrations at
    host `localhost`, port `1025`, TLS off, and read everything it "sends" at
    <http://localhost:8025>. The whole newsletter path (opt-in, broadcast, reply,
    test send, the open pixel) works end to end with no real SMTP account or inbox.
- Read [`CLAUDE.md`](./CLAUDE.md) (operating rules + invariants) and
  [`ARCHITECTURE.md`](./ARCHITECTURE.md) (the *why*) before a non-trivial change.
- For admin/editor work, also read [`docs/admin-redesign-2026-07.md`](./docs/admin-redesign-2026-07.md)
  and the latest concrete implementation record, currently
  [`docs/worklog-2026-07-13.md`](./docs/worklog-2026-07-13.md).

## Before you open a PR — Definition of Done

A change is done only when **`npm run check:all` exits 0** *and* you have run the change
on the local stack and looked at it. `check:all` catches broken code; it does not catch a
column that truncates to nothing or a label that no longer matches the control. Bring up
`docker-compose.dev.yml`, `npm run dev`, sign in with `DEV_LOGIN`, and drive the page with
a headless browser (Playwright/Puppeteer — not vendored; `npx playwright install chromium`)
so you can screenshot it and read the DOM rather than reasoning about CSS from source. Mail
goes to Mailpit at <http://localhost:8025>. **Never test against a production site** — a
send, delete or purge there is real and cannot be undone. It runs, offline with no
credentials: `typecheck` + `lint` + the `check:routes`/`check:filesize`/`check:no-any`/
`check:no-direct-blob`/`check:token-bust` guards + the `vitest` seam net. CI runs the
same plus `npm run build`.

If your change touches behaviour that a check doesn't cover, **add a test in the same
commit**. If it changes behaviour, **update the matching docs in the same commit**
(CLAUDE.md rules, the relevant `docs/*`, ARCHITECTURE.md, README.md).
For a broad visual pass, keep one dated worklog as the canonical detailed record and update the
short contracts in the living docs; do not rewrite historical audit reports to describe new state.

## House rules (the short version)

- **Simplicity first, surgical changes** — the minimum code that solves the problem;
  touch only what you must; don't refactor or restyle adjacent code.
- **Invariants are load-bearing** — the 7 invariants in CLAUDE.md are pinned by tests/
  guards. Don't break them; if you must change one, update its enforcement + docs.
- **Public UI** uses theme tokens + the type-system roles only (no hardcoded colours/
  sizes/tracking) and keeps sharp corners. Admin uses the shared 16/12/8px radius hierarchy.
  Details in `docs/conventions.md`.
- **i18n**: user-facing strings live in `src/locales/` in all 6 languages (en default).
  Code, comments, identifiers, and commits are English.
- Max 400 lines per file. No `any` (use `unknown` + narrowing).

## Commits & PRs

- Conventional-commit style subject (`fix:`, `feat:`, `refactor:`, `docs:` …).
- Keep PRs focused; describe what changed and how you verified it.
- Security issue? See [`SECURITY.md`](./SECURITY.md) — do not open a public issue.
