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

| Variable                | What it is                                  |
| ----------------------- | ------------------------------------------- |
| `AUTH_SECRET`           | NextAuth secret — `npx auth secret`         |
| `AUTH_GITHUB_ID`        | GitHub OAuth app client id                  |
| `AUTH_GITHUB_SECRET`    | GitHub OAuth app client secret              |
| `AUTHORIZED_EMAIL`      | The only GitHub email allowed into `/admin` |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token                |

GitHub OAuth callback URL: `https://<your-domain>/api/auth/callback/github`
(use `http://localhost:3000/...` for local development).

## Two-repo pattern

This repo (`vibeblog`) is the **public, open-source platform** — MIT licensed,
zero personal data. Anyone can fork and self-host.

Keep your personal stuff in a **separate private repo** (e.g. `vibeblog-private`),
containing only:

- `.env.local` with your real credentials
- `CLAUDE.md` with your personal operating notes

Your actual blog content lives in Vercel Blob, not in git.

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
