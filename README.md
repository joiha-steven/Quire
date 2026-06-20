# vibeblog

An AI-operated personal blog platform. Write and publish from a multilingual admin
UI; everything (posts + media) is stored in **Vercel Blob** — no database.

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **Storage:** Vercel Blob (`posts/`, `media/`, each with an `_index.json` manifest); image refs stored store-relative (no vendor lock-in)
- **Auth:** NextAuth v5 (Google and/or GitHub OAuth), single authorized owner
- **Editor:** TipTap 3 with Markdown; responsive images via `sharp` (original + AVIF/WebP variants, encoded on save)
- **UI languages:** en (default), vi, de, ja, zh, ko
- **Styles:** Tailwind CSS v4
- **Deploy:** Vercel (Docker self-host is on the [roadmap](./ROADMAP.md))
- **Requires:** Node.js 20.9+ (Next 16)

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

Public pages are **ISR-cached** (`revalidate`; `/[slug]` prerendered) so visitors get
fast cached HTML, and **every admin save purges the affected pages** through one place
(`src/lib/revalidate.ts`) — a new post refreshes the list/taxonomy surfaces, editing a
post also refreshes its own page, and a settings change purges the whole site. Each
purge is a deliberate superset of what a change can touch, so an edit (content, theme,
anything) is live on the next request without ever under-purging. There is no separate
data cache (`unstable_cache` was removed; it kept serving stale content); Blob reads are
`?ts`-busted so each regeneration is fresh, and the Full Route Cache is per-deployment so
a new deploy never serves stale pages. Admin is fully dynamic (uncached); editor saves
also `router.refresh()`, and a "Clear all cache" button purges + warms on demand. The
Blob store and functions are both in Singapore (`vercel.json` pins `sin1`); images keep
a 1-year CDN cache. List pages use **path-based pagination** (`/page/2`,
`/category/x/page/2` — no `?query`). Uploaded photos keep the untouched original and
serve responsive AVIF/WebP variants (`<picture>`, only once the variants exist).

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

## Roadmap

Planned: Docker self-host (pluggable S3/MinIO/local storage), publishing from Markdown
note apps (Obsidian, then Craft), and optional AI assist in the editor. See
[`ROADMAP.md`](./ROADMAP.md).

## License

MIT
