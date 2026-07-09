# Contributing to Quire

Thanks for helping. Quire values small, correct, well-scoped changes.

## Getting set up

- Node ≥ 20.9 (CI runs 24). `npm ci` to install.
- Self-host locally with Docker (`docker compose up -d --build`) or natively — see
  [`README.md`](./README.md) and [`docs/self-host-native.md`](./docs/self-host-native.md).
- Read [`CLAUDE.md`](./CLAUDE.md) (operating rules + invariants) and
  [`ARCHITECTURE.md`](./ARCHITECTURE.md) (the *why*) before a non-trivial change.

## Before you open a PR — Definition of Done

A change is done only when **`npm run check:all` exits 0**. It runs, offline with no
credentials: `typecheck` + `lint` + the `check:routes`/`check:filesize`/`check:no-any`/
`check:no-direct-blob`/`check:token-bust` guards + the `vitest` seam net. CI runs the
same plus `npm run build`.

If your change touches behaviour that a check doesn't cover, **add a test in the same
commit**. If it changes behaviour, **update the matching docs in the same commit**
(CLAUDE.md rules, the relevant `docs/*`, ARCHITECTURE.md, README.md).

## House rules (the short version)

- **Simplicity first, surgical changes** — the minimum code that solves the problem;
  touch only what you must; don't refactor or restyle adjacent code.
- **Invariants are load-bearing** — the 7 invariants in CLAUDE.md are pinned by tests/
  guards. Don't break them; if you must change one, update its enforcement + docs.
- **Public UI** uses theme tokens + the type-system roles only (no hardcoded colours/
  sizes/tracking); **sharp corners** everywhere. Details in `docs/conventions.md`.
- **i18n**: user-facing strings live in `src/locales/` in all 6 languages (en default).
  Code, comments, identifiers, and commits are English.
- Max 400 lines per file. No `any` (use `unknown` + narrowing).

## Commits & PRs

- Conventional-commit style subject (`fix:`, `feat:`, `refactor:`, `docs:` …).
- Keep PRs focused; describe what changed and how you verified it.
- Security issue? See [`SECURITY.md`](./SECURITY.md) — do not open a public issue.
