@AGENTS.md

# vibeblog — operating notes

Public, open-source blog platform. **Zero personal data in this repo.** Real
credentials + personal notes live in a separate private repo (see README).

## Architecture
- No database. All content is in Vercel Blob.
  - `posts/_index.json` — array of post metadata (no body); the only query layer.
  - `posts/{slug}.md` — YAML frontmatter + markdown body.
  - `media/_index.json` — array of MediaItem.
  - `media/{timestamp}-{name}` — uploaded files (original name preserved).
- Every write/delete updates the relevant `_index.json` (read → modify → write).
- `src/lib` is the data layer; `src/app/api` are thin route handlers; UI is in
  `src/components`.

## Conventions
- UI text (labels, buttons, toasts, placeholders) → Vietnamese.
- Code, comments, identifiers, filenames, commits → English.
- Max 400 lines per file. No `any` (use `unknown` + narrowing).
- No hardcoded Vietnamese strings in `lib/` or `api/` — components only.
- Every API handler: time + log the request, try/catch with logged errors.
- Auth: only `AUTHORIZED_EMAIL` reaches `/admin`; all write/delete routes are
  owner-gated server-side (401 otherwise).

## Next.js 16 reminders
- `params` / `searchParams` are async (await them).
- Use `PageProps<...>` / `RouteContext<...>` global type helpers.
