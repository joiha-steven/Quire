# vibeblog

An AI-operated personal blog platform. Write and publish from a multilingual admin
UI; everything (posts + media) is stored in **Vercel Blob** — no database.

- **Framework:** Next.js (App Router) + TypeScript (strict)
- **Storage:** Vercel Blob (`posts/`, `media/`, each with an `_index.json` manifest); image refs stored store-relative (no vendor lock-in)
- **Auth:** NextAuth v5, GitHub OAuth, single authorized owner
- **Editor:** TipTap with markdown; responsive images (original + AVIF/WebP variants, encoded on save)
- **UI languages:** en (default), vi, de, ja, zh, ko
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

## Secrets & personal data

This repo (`vibeblog`) is the **public, open-source platform** — MIT licensed,
zero personal data. Anyone can fork and self-host.

Keep secrets out of git: your real credentials live in `.env.local` (gitignored
via `.env*`) and on Vercel (retrieve any time with `vercel env pull`). Your actual
blog content lives in Vercel Blob, not in git. Don't commit personal data here.

## Performance & caching

Reads are **always fresh** — there is no data cache. Every page is `force-dynamic`
and reads straight from Blob each request (`React.cache()` only dedupes within one
render), so an edit shows on the next load with no rebuild or revalidation. We
removed `unstable_cache` deliberately: caching over Blob kept serving stale content.
The Blob store is in Singapore beside the functions (`vercel.json` pins `sin1`), so
reads are cheap; images keep a 1-year CDN cache. List pages use **path-based
pagination** (`/page/2`, `/category/x/page/2` — no `?query`, SEO-friendly). Uploaded
photos keep the untouched original and serve responsive AVIF/WebP variants
(`<picture>`, emitted only once the variants exist); variant encoding is deferred to save.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and the *why*.

## Deploy to Vercel

1. Push this repo to GitHub and import it into Vercel.
2. Add a **Blob** store (Storage tab) — this sets `BLOB_READ_WRITE_TOKEN`.
3. Add the remaining env vars from `.env.example`.
4. Deploy. Visit `/admin` and sign in with the authorized GitHub account.

## Usage

- `/` — public blog (published, date-reached posts only)
- `/search` — client-side search · `/category/<x>`, `/tag/<x>` — taxonomy lists
- `/admin` — dashboard (owner only); `/admin/editor`, `/admin/media`, `/admin/settings`
- SEO / feeds (toggleable in Settings → SEO): `/sitemap.xml`, `/robots.txt`,
  `/feed.xml` (RSS), `/llms.txt`, `/og` (dynamic share image)

## License

MIT
