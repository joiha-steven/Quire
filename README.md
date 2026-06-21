# vibe**blog** (v0.9.9)

An AI-operated personal blog platform. Write and publish from a multilingual admin
UI; everything (posts + media) is stored in **Vercel Blob** — no database.

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **Storage:** Vercel Blob (`posts/`, `pages/`, `media/`, `revisions/`, `files/`, `settings/`; each content kind has an `_index.json` manifest); image refs stored store-relative (no vendor lock-in)
- **Auth:** NextAuth v5 (Google and/or GitHub OAuth), single authorized owner
- **Editor:** TipTap 3 with Markdown; responsive images via `sharp` (original + AVIF/WebP variants, encoded on save); a 3-version time machine per post
- **Theming:** 6 built-in light+dark color palettes, each fully customizable; visitors can switch palette and light/dark/system/by-time mode; optional custom CSS
- **PWA:** installable to the iPhone/Android home screen, launches standalone (no service worker / no offline by design)
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

vibeblog is built for Vercel. Two ways to install your own copy: do it yourself in
the dashboard, or hand the whole job to an AI agent.

### A. Manual (Vercel dashboard)

1. **Fork** this repo on GitHub (so you own the copy Vercel deploys).
2. In Vercel: **Add New → Project**, then import your fork.
3. **Storage → Create → Blob**, and connect the store to the project. This injects
   `BLOB_READ_WRITE_TOKEN` automatically — the only storage config you need.
4. Add the rest under **Settings → Environment Variables** (see `.env.example`):
   - `AUTH_SECRET` — run `npx auth secret` and paste the output.
   - `AUTHORIZED_EMAIL` — the single email allowed into `/admin`.
   - At least one OAuth provider: `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`, and/or
     `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET`.
5. **Deploy.**
6. **Register the OAuth callback URL** with your provider, using the live domain:
   - Google: `https://<your-domain>/api/auth/callback/google`
   - GitHub: `https://<your-domain>/api/auth/callback/github`

   Add both your `*.vercel.app` URL and any custom domain.
7. Open `https://<your-domain>/admin`, sign in as `AUTHORIZED_EMAIL`, and set your
   title / palette / menu in **Settings**. That's it — start writing.

> **Two `vercel.json` settings to adjust for yourself:**
> - `regions: ["sin1"]` pins functions to **Singapore** — that is simply the original
>   author's nearest region (a Vietnam audience), not a requirement. **Change it to your
>   own nearest region**, or delete the `regions` line to let Vercel pick automatically.
> - `maxDuration: 60` gives image uploads up to 60s. That can exceed the **free (Hobby)**
>   plan's function limit, so very large photo uploads may time out — lower it, keep
>   images modest, or upgrade to Pro.

### B. Via an AI agent (OpenClaw, Hermes, Claude, …)

Rather not click through Vercel? Hand it to any AI agent that can act on **Vercel**
(through the Vercel API / CLI / MCP) and **GitHub**. Give the agent:

- this repository URL (to fork + import),
- your `AUTHORIZED_EMAIL`,
- your OAuth app credentials (or let it create the OAuth app if it has provider access),
- a **Vercel token** (Account → Settings → Tokens) and GitHub access.

Then ask it to: *fork the repo, create a Vercel project from it, add a Blob store,
generate `AUTH_SECRET`, set the environment variables above, deploy, and return the
live URL.* Finish by registering the OAuth callback URL (step 6 above) and signing in
at `/admin`. The only step an agent can't do alone is the OAuth **provider** setup
(it needs your Google/GitHub login) — pre-create that app, or grant access.

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

Two separate layers — keep them distinct:

- **Code (this repository) — [MIT](./LICENSE).** Free and open source. Use, modify,
  redistribute, or sell it freely, for any purpose, with **no obligation to credit**
  the author (MIT only asks that the license text travels with copies of the source).
  Fork it and run your own blog.
- **Content — © all rights reserved.** The blog content published *with* vibeblog
  (articles, images, and other writing on an operator's site, e.g. manhhung.me) is the
  property of its author and is **not** covered by the MIT license. It does not live in
  this repository and may not be reused without permission.

In short: the **software** is open for anyone; the **author's writing** is not.
