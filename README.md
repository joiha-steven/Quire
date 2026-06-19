# vibeblog

An AI-operated personal blog platform. Write and publish from a Vietnamese admin
UI; everything (posts + media) is stored in **Vercel Blob** — no database.

- **Framework:** Next.js (App Router) + TypeScript (strict)
- **Storage:** Vercel Blob (`posts/`, `media/`, each with an `_index.json` manifest)
- **Auth:** NextAuth v5, GitHub OAuth, single authorized owner
- **Editor:** TipTap with markdown
- **Styles:** Tailwind CSS v4
- **Deploy:** Vercel

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

### Required environment variables

See [`.env.example`](./.env.example). In short:

| Variable                          | What it is                                |
| --------------------------------- | ----------------------------------------- |
| `AUTH_SECRET`                     | NextAuth secret — `npx auth secret`       |
| `AUTH_GOOGLE_ID` / `_SECRET`      | Google OAuth client (optional provider)   |
| `AUTH_GITHUB_ID` / `_SECRET`      | GitHub OAuth app (optional provider)      |
| `AUTHORIZED_EMAIL`                | The only email allowed into `/admin`      |
| `BLOB_READ_WRITE_TOKEN`           | Vercel Blob read/write token              |

Enable at least one provider; each loads only when its credentials are set.
OAuth callback URLs: `https://<your-domain>/api/auth/callback/google` and/or
`.../callback/github` (use `http://localhost:3000/...` locally).

> **Note:** `BLOB_READ_WRITE_TOKEN` is also used to derive the public Blob store
> URL at runtime — no extra env var needed. The token format
> `vercel_blob_rw_<storeId>_<secret>` encodes the store ID directly.

## Two-repo pattern

This repo (`vibeblog`) is the **public, open-source platform** — MIT licensed,
zero personal data. Anyone can fork and self-host.

Keep your personal stuff in a **separate private repo** (e.g. `vibeblog-private`),
containing only:

- `.env.local` with your real credentials
- `CLAUDE.md` with your personal operating notes

Your actual blog content lives in Vercel Blob, not in git.

## Performance & caching

Post detail pages (`/[slug]`) are statically generated at deploy time (ISR). New
posts are rendered on-demand on first visit, then cached. Admin save/delete
automatically invalidates the relevant caches via `revalidateTag` +
`revalidatePath`.

List pages (home, category, tag) are server-rendered per request (because of
pagination via `searchParams`), but `getPublicPosts` and `getSettings` are cached
via Next.js 16 Cache Components (`'use cache'` directive) and only re-fetched when
a post or setting is changed.

## Deploy to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Add a **Blob** store (Storage tab) — this sets `BLOB_READ_WRITE_TOKEN`.
3. Add the remaining env vars from `.env.example`.
4. Deploy. Visit `/admin` and sign in with the authorized GitHub account.

## Usage

- `/` — public blog (published, date-reached posts only)
- `/admin` — dashboard (owner only)
- `/admin/editor` — write a new post
- `/admin/media` — media library

## License

MIT
