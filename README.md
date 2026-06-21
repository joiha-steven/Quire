# vibe**blog** (v0.9.27)

An AI-operated personal blog platform. Write and publish from a multilingual admin
UI. Text content (posts, pages, settings, metadata) lives in **Supabase Postgres**;
binaries (images, attachments, icons) live in **Vercel Blob**.

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript (strict)
- **Storage:** Supabase Postgres for all text (`posts`/`pages`/`post_revisions`/`media`/`files`/`settings` tables; post bodies are Markdown in a text column); Vercel Blob for binaries only. Image refs stored store-relative (no vendor lock-in)
- **Auth:** NextAuth v5 (Google and/or GitHub OAuth), single authorized owner
- **Editor:** TipTap 3 with Markdown; responsive images via `sharp` (original + AVIF/WebP variants, encoded in the background after save); a 3-version time machine per post
- **Theming:** 6 built-in light+dark color palettes, each fully customizable; visitors can switch palette and light/dark/system/by-time mode; optional custom CSS
- **Typography:** one tunable type system — every text role (h1–h5, body, small, caption, code) has its own size / line-height / letter-spacing, applied site-wide via CSS variables (no hardcoded sizes); upload a custom typeface per weight (Regular/Medium/SemiBold/Bold); one font for everything
- **PWA:** installable to the iPhone/Android home screen, launches standalone (no service worker / no offline by design)
- **Admin:** Overview with a System panel (hosting/region/env + database + storage); a toggleable activity log (Admin → Log) recording every save/upload/delete
- **UI languages:** en (default), vi, de, ja, zh, ko
- **Styles:** Tailwind CSS v4
- **Deploy:** Vercel (Docker self-host is on the [roadmap](./ROADMAP.md))
- **Requires:** Node.js 20.9+ (Next 16)

## Local setup

### Prerequisites

- **Node.js 20.9+** (Next 16) and npm.
- A **Supabase** project (free tier is fine) — holds all text content.
- A **Vercel Blob** store — holds binaries (images/files/icons). You need its
  read/write token; you don't have to deploy to Vercel to use Blob locally.
- At least one **OAuth app** — Google and/or GitHub — for admin sign-in.

### Steps

1. **Clone + install**

   ```bash
   git clone https://github.com/joiha-steven/vibeblog.git
   cd vibeblog
   npm install
   ```

2. **Create the database.** In your Supabase project open **SQL Editor → New query**,
   paste the contents of [`scripts/schema.sql`](./scripts/schema.sql), and **Run**. This
   creates every table, index, and RPC the app needs (idempotent — safe to re-run).

3. **Get your Supabase keys.** Supabase **Project Settings → API**: copy the
   **Project URL** (`SUPABASE_URL`) and the **`service_role`** key
   (`SUPABASE_SERVICE_ROLE_KEY` — secret, server-only).

4. **Get a Blob token.** In the Vercel dashboard, **Storage → Create → Blob**, then in
   the store's **`.env` / Tokens** tab copy the `BLOB_READ_WRITE_TOKEN`
   (`vercel_blob_rw_…`). No need to deploy first.

5. **Create an OAuth app** (at least one):
   - **Google** — [Cloud Console](https://console.cloud.google.com/) → Credentials →
     OAuth client ID (Web). Authorized redirect URI:
     `http://localhost:3000/api/auth/callback/google`.
   - **GitHub** — Settings → Developer settings → OAuth Apps → New. Callback URL:
     `http://localhost:3000/api/auth/callback/github`.

6. **Configure env.**

   ```bash
   cp .env.example .env.local   # then fill in the values below
   npx auth secret              # generates AUTH_SECRET — paste it in
   ```

7. **Run it.**

   ```bash
   npm run dev
   ```

   Open `http://localhost:3000/admin`, sign in as your `AUTHORIZED_EMAIL`, and set your
   title / palette / menu in **Settings**. Start writing.

### Required environment variables

See [`.env.example`](./.env.example). In short:

| Variable                          | What it is                                |
| --------------------------------- | ----------------------------------------- |
| `AUTH_SECRET`                     | NextAuth secret — `npx auth secret`       |
| `AUTHORIZED_EMAIL`                | The only email allowed into `/admin`      |
| `AUTH_GOOGLE_ID` / `_SECRET`      | Google OAuth client (optional provider)   |
| `AUTH_GITHUB_ID` / `_SECRET`      | GitHub OAuth app (optional provider)      |
| `SUPABASE_URL`                    | Supabase project API URL                  |
| `SUPABASE_SERVICE_ROLE_KEY`       | Supabase service_role key (secret, server-only) |
| `BLOB_READ_WRITE_TOKEN`           | Vercel Blob read/write token              |
| `CRON_SECRET`                     | Protects `/api/cron` (optional)           |

Enable at least one provider; each loads only when its credentials are set. For
production, register the same callback URLs against your live domain (see
[Deploy to Vercel](#deploy-to-vercel)).

> **Note:** `BLOB_READ_WRITE_TOKEN` is also used to derive the public Blob store
> URL at runtime — no extra env var needed. The token format
> `vercel_blob_rw_<storeId>_<secret>` encodes the store ID directly.

## Secrets & personal data

This repo (`vibeblog`) is the **public, open-source platform** — MIT licensed,
zero personal data. Anyone can fork and self-host.

Keep secrets out of git: your real credentials live in `.env.local` (gitignored
via `.env*`) and on Vercel (retrieve any time with `vercel env pull`). Your actual
blog content lives in Supabase Postgres + Vercel Blob, not in git. Don't commit personal data here.

## Performance & caching

Public pages are **ISR-cached** (`revalidate`; `/[slug]` prerendered) so visitors get
fast cached HTML, and **every admin save purges the affected pages** through one place
(`src/lib/revalidate.ts`) — a new post refreshes the list/taxonomy surfaces, editing a
post also refreshes its own page, and a settings change purges the whole site. Each
purge is a deliberate superset of what a change can touch, so an edit (content, theme,
anything) is live on the next request without ever under-purging. The Supabase reads are
tagged `db` and every save calls `revalidateTag('db')`, so a re-rendered page always reads
fresh from Postgres (never a stale Data Cache entry). Admin is fully dynamic (uncached);
editor saves also `router.refresh()`, and a "Clear all cache" button purges + warms on
demand. Functions run in Singapore (`vercel.json` pins `sin1`), co-located with the
Supabase project (ap-southeast-1); images keep a 1-year CDN cache on the Blob host. List
pages use **path-based pagination** (`/page/2`,
`/category/x/page/2` — no `?query`). Uploaded photos keep the untouched original and
serve responsive AVIF/WebP variants (`<picture>`, only once the variants exist).

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and the *why*.

## Deploy to Vercel

vibeblog is built for Vercel. Two ways to install your own copy: do it yourself in
the dashboard, or hand the whole job to an AI agent.

### A. Manual (Vercel dashboard)

1. **Fork** this repo on GitHub (so you own the copy Vercel deploys).
2. **Create the database.** In a [Supabase](https://supabase.com) project, run
   [`scripts/schema.sql`](./scripts/schema.sql) in the SQL Editor (creates all tables +
   RPCs). Note the **Project URL** and **`service_role`** key (Project Settings → API).
3. In Vercel: **Add New → Project**, then import your fork.
4. **Storage → Create → Blob**, and connect the store to the project. This injects
   `BLOB_READ_WRITE_TOKEN` automatically — the only storage config you need.
5. Add the rest under **Settings → Environment Variables** (see `.env.example`):
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` — from step 2.
   - `AUTH_SECRET` — run `npx auth secret` and paste the output.
   - `AUTHORIZED_EMAIL` — the single email allowed into `/admin`.
   - At least one OAuth provider: `AUTH_GOOGLE_ID` + `AUTH_GOOGLE_SECRET`, and/or
     `AUTH_GITHUB_ID` + `AUTH_GITHUB_SECRET`.
6. **Deploy.**
7. **Register the OAuth callback URL** with your provider, using the live domain:
   - Google: `https://<your-domain>/api/auth/callback/google`
   - GitHub: `https://<your-domain>/api/auth/callback/github`

   Add both your `*.vercel.app` URL and any custom domain.
8. Open `https://<your-domain>/admin`, sign in as `AUTHORIZED_EMAIL`, and set your
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
and **Supabase** (through their API / CLI / MCP) and **GitHub**. Give the agent:

- this repository URL (to fork + import),
- your `AUTHORIZED_EMAIL`,
- your OAuth app credentials (or let it create the OAuth app if it has provider access),
- a **Vercel token** (Account → Settings → Tokens), **Supabase** access, and GitHub access.

Then ask it to: *fork the repo, create a Supabase project and run `scripts/schema.sql`
on it, create a Vercel project from the fork, add a Blob store, generate `AUTH_SECRET`,
set the environment variables above (incl. `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`),
deploy, and return the live URL.* Finish by registering the OAuth callback URL (step 7
above) and signing in at `/admin`. The only step an agent can't do alone is the OAuth
**provider** setup (it needs your Google/GitHub login) — pre-create that app, or grant access.

## Usage

- `/` — public blog (published, date-reached posts only); posts get Shiki-highlighted code,
  intrinsic-sized (CLS-free) images, and a back-to-top button
- Header search opens an in-place overlay (instant local title/tag + full-text body search via
  Postgres `tsvector`); `/search` still works for deep links · `/category/<x>`, `/tag/<x>` — taxonomy lists
- `/admin` — dashboard (owner only); `/admin/editor`, `/admin/media`, `/admin/analytics`,
  `/admin/settings`. Built-in cookieless analytics (views / unique visitors / top pages, no PII)
- SEO / feeds (toggleable in Settings → SEO): `/sitemap.xml`, `/robots.txt`,
  `/feed.xml` (RSS), `/llms.txt`, `/og` (dynamic share image)

### Settings (`/admin/settings`)

One form, one Save button, three tabs:

- **General** — site title / description / language, logo + favicon + app icon, content width &
  posts-per-page, header menu, reader features (search, ToC, related, reading time, progress bar,
  activity log), and SEO toggles.
- **Appearance** — colors (pick any of the 6 palettes and edit its light+dark colors; set the
  visitor default), the custom **font** (upload one file per weight: Regular / Medium / SemiBold /
  Bold — all share one family, Inter is the fallback), and the **text sizes** table (size /
  line-height / letter-spacing for every role: h1–h5, body, small, caption, code). One "reset to
  default" restores the tuned scale.
- **Advanced** — font smoothing (anti-aliasing) toggle and custom CSS.

Everything is stored in the single `settings` row and injected as CSS variables, so changes apply
site-wide with no redeploy.

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
