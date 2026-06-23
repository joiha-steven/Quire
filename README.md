<div align="center">

# vibe**blog** &nbsp;`v1.1.4`

**An AI-operated personal blog platform.**
Write and publish from a clean multilingual admin — or hand the keys to an AI agent and let it write, publish, and even deploy for you.

<br/>

![Next.js 16](https://img.shields.io/badge/Next.js_16-000000?logo=nextdotjs&logoColor=white)
![React 19](https://img.shields.io/badge/React_19-20232a?logo=react&logoColor=61dafb)
![TypeScript](https://img.shields.io/badge/TypeScript-3178c6?logo=typescript&logoColor=white)
![Tailwind v4](https://img.shields.io/badge/Tailwind_v4-0b1120?logo=tailwindcss&logoColor=38bdf8)
![Supabase](https://img.shields.io/badge/Supabase-3ecf8e?logo=supabase&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?logo=vercel&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-self--host-2496ed?logo=docker&logoColor=white)
![MCP](https://img.shields.io/badge/MCP-ready-7c3aed)
![License: MIT](https://img.shields.io/badge/License-MIT-22c55e)

[**🌐 Live demo**](https://manhhung.me) · [**Get your own copy**](#-get-your-own-copy) · [**Let an AI run it**](#-let-an-ai-agent-write--publish-mcp) · [**Architecture**](./ARCHITECTURE.md) · [**Roadmap**](./ROADMAP.md) · [**License**](#-license)

<sub>The demo at **manhhung.me** is the author's personal blog — a live instance to see the *platform* in action, not a content showcase (ignore what it says, look at how it works).</sub>

<br/>

<img src="docs/demo.jpg" alt="vibeblog admin dashboard and reading view" width="900">

</div>

---

## ✨ What it is

An **open-source** (MIT), single-owner blog built for people who just want to **write**. The public site is statically cached so it loads **insanely fast on mobile and desktop**, and it's tuned around **readable typography** — a clean reading experience first. Everything is **easy to tweak from the admin** (palettes, type, menu, fonts) with **no hardcoded values** anywhere, so you make it yours without touching code.

All the writing happens in a polished `/admin` (or over MCP). Text lives in **Postgres** (Supabase on Vercel, or a bundled Postgres when you self-host); binaries (images, files, icons) go through a pluggable storage driver — **Vercel Blob** by default, or the **local filesystem** on Docker. No git push to publish, no CMS to wrangle.

| Area | What you get |
|:---|:---|
| 🖋️&nbsp;**Editor** | TipTap 3 + Markdown · responsive `sharp` images (original + AVIF/WebP variants) · 3-version time machine · 60s autosave |
| 🎨&nbsp;**Look** | 6 customizable light+dark palettes · one tunable type system (per-role size/leading/tracking, no hardcoded sizes) · upload a custom font per weight |
| 🌍&nbsp;**i18n** | Admin + site in `en · vi · de · ja · zh · ko` |
| 🔍&nbsp;**Reading** | instant local + Postgres full-text search · ToC · related posts · reading time · progress bar |
| 📈&nbsp;**Built-in** | cookieless analytics (views / visitors / top pages, no PII) · activity log · soft-delete Trash (nothing auto-purges) |
| 🔎&nbsp;**SEO** | sitemap · RSS · `robots.txt` · `llms.txt` · dynamic OG images — all toggleable |
| 💾&nbsp;**Backups** | one-click full snapshots (DB + all binaries) to **Google Drive**, scheduled + restore |
| 🤖&nbsp;**MCP** | a remote endpoint that lets an AI agent write & manage the blog with the same rules as the admin |
| 📱&nbsp;**PWA** | installable, launches standalone |
| 🔐&nbsp;**Auth** | NextAuth v5 · Google sign-in · single authorized owner · edge-guarded admin/API |
| 🚀&nbsp;**Deploy** | Vercel + Supabase (+ Vercel Blob), **or** self-host with Docker — bundled Postgres + local storage, **no cloud** — same codebase |

> Built on **Next.js 16** (App Router, React 19, strict TS) + **Tailwind v4**, deployed on **Vercel** or self-hosted with **Docker**.

**Who it's for** — one person who wants a fast, good-looking, fully self-owned blog, runs it on Vercel + Supabase **or self-hosts it with Docker**, and likes the idea of letting an AI agent help run it.
**Not for** — multi-author teams / publications needing roles and editorial workflows. vibeblog is single-owner by design (one authorized email); multi-tenant lives in the planned SaaS, not here.

---

## 🚀 Get your own copy

Three ways to stand up your own blog — **pick one**. Each ends with a live site at your domain.

<details open>
<summary><b>1️⃣ &nbsp;Do it yourself</b> &nbsp;— ~10 minutes in the dashboards</summary>

<br/>

1. **Fork** this repo (so Vercel deploys *your* copy).
2. **Database** — create a [Supabase](https://supabase.com) project → SQL Editor → paste [`scripts/schema.sql`](./scripts/schema.sql) → **Run** (idempotent). Copy the **Project URL** + **`service_role`** key (Settings → API).
3. **Import to Vercel** — *Add New → Project* → import your fork.
4. **Blob store** — *Storage → Create → Blob*, connect it to the project. This injects `BLOB_READ_WRITE_TOKEN` automatically.
5. **Env vars** (Settings → Environment Variables — see [the table](#-environment-variables)):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET` (`npx auth secret`), `AUTHORIZED_EMAIL`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`.
6. **Deploy.** Then on your [Google OAuth client](https://console.cloud.google.com/apis/credentials) add the redirect URI `https://<your-domain>/api/auth/callback/google`.
7. Open `https://<your-domain>/admin`, sign in as `AUTHORIZED_EMAIL`, set your title / palette / menu in **Settings**, and start writing.

</details>

<details open>
<summary><b>2️⃣ &nbsp;Hand it to an AI agent</b> &nbsp;— Claude, OpenAI Codex, OpenClaw, Hermes…</summary>

<br/>

Give an agent **Vercel + Supabase + GitHub access** (tokens / CLI / MCP), then paste:

```text
Deploy my own copy of github.com/joiha-steven/vibeblog:
1. Fork the repo to my account.
2. Create a Supabase project and run scripts/schema.sql in its SQL editor.
3. Create a Vercel project from the fork; add a Vercel Blob store (this sets BLOB_READ_WRITE_TOKEN).
4. Walk me step by step through creating a Google OAuth "Web" client
   (you can't log into my Google account, so guide me through the Cloud Console:
   create the project, configure the consent screen, create the OAuth client,
   and tell me exactly what to click), then collect the resulting
   AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET from me.
5. Set env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (Supabase → Settings → API),
   AUTH_SECRET (generate with `npx auth secret`), AUTHORIZED_EMAIL=<my email>,
   AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET.
6. Deploy, then tell me to register https://<domain>/api/auth/callback/google
   as a redirect URI on the Google client.
7. Return the live URL.
```

> The agent does everything else; for the Google OAuth app it **walks you through the clicks** (it can't log into your Google account) and takes the client ID/secret back from you.

</details>

<details>
<summary><b>3️⃣ &nbsp;Self-host with Docker</b> &nbsp;— your own server, no Vercel</summary>

<br/>

**Fully self-contained — no cloud accounts.** The stack bundles **Postgres + PostgREST** (replaces Supabase) and the **local filesystem** store (replaces Vercel Blob), plus a cron sidecar. Everything runs on your host; only Google sign-in reaches the internet. Data lives in `./data/postgres` (text) + `./data/uploads` (binaries) — back up those two folders.

```bash
git clone https://github.com/joiha-steven/vibeblog.git && cd vibeblog
cp .env.docker.example .env.docker
node scripts/docker/gen-keys.mjs >> .env.docker   # DB password + JWT secret + service key
# then fill AUTH_SECRET, AUTH_GOOGLE_ID/SECRET, AUTHORIZED_EMAIL, SITE_URL, CRON_SECRET
docker compose up -d --build   # app on :3000 + db + rest + cron
```

Then point a reverse proxy / TLS at port `3000`, and register `<SITE_URL>/api/auth/callback/google` (and `<SITE_URL>/api/backup/callback` for Drive backups) on your Google OAuth client. The image needs **no backend env to build** — secrets are supplied at runtime. The bundled DB applies `scripts/schema.sql` automatically on first boot. Prefer a managed database? Point `SUPABASE_URL` at any Supabase project and drop the `db`/`rest` services — see [`.env.docker.example`](./.env.docker.example). The Vercel path is unchanged (Supabase + Blob).

</details>

> [!TIP]
> **Vercel:** two `vercel.json` knobs to make yours — `regions` (defaults to `sin1`/Singapore — set your nearest) and `maxDuration: 60` for uploads (the free Hobby plan caps function time, so trim it or upgrade to Pro for big photos). **Docker:** large uploads have no 4.5 MB cap (the browser posts straight to the server), so big photos just work.

---

## 🤖 Let an AI agent write & publish (MCP)

vibeblog ships a remote **MCP** server, so a second AI agent can run your blog — drafting, editing, tagging, and **publishing straight to the live site**. No git, no deploy: content goes into Supabase + Blob through the same data layer (and same slug/revision/soft-delete rules) the admin uses.

1. **Turn it on** — *Admin → Settings → Advanced → MCP*, generate a named token (shown **once**, hashed at rest, expires in 180 days).
2. **Connect your agent** to the endpoint `https://<your-domain>/api/mcp` with `Authorization: Bearer <token>` (OAuth connectors are supported too).
3. **Prompt it**, e.g.:

```text
Using the vibeblog MCP server, write a 600-word post titled
"What I learned shipping a blog with an AI agent", give it the tags
"ai" and "writing", set a friendly excerpt, and publish it.
```

The post is live in seconds. Sensitive settings are blocked over MCP, and you stay the sole authority — revoke any token from the admin and it's gone.

---

## 🔑 Environment variables

See [`.env.example`](./.env.example). The essentials:

| Variable | Required | What it is · where to get it |
|---|:---:|---|
| `AUTH_SECRET` | ✅ | NextAuth secret — generate with `npx auth secret` |
| `AUTHORIZED_EMAIL` | ✅ | The only email allowed into `/admin` — your email |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | ✅ | Google OAuth "Web" client (admin sign-in + optional commenter login) — [Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials) |
| `SUPABASE_URL` | ✅ | Supabase project API URL — Supabase → Settings → API. **Docker:** auto-set to the bundled PostgREST (`http://rest:3000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase `service_role` key (secret, server-only) — same page. **Docker:** generate with `node scripts/docker/gen-keys.mjs` |
| `POSTGRES_PASSWORD` / `SUPABASE_JWT_SECRET` | ◻️ Docker | Bundled-DB secrets for the local Postgres + PostgREST — produced by `gen-keys.mjs` alongside the key above |
| `BLOB_READ_WRITE_TOKEN` | ✅ Vercel | Vercel Blob token — **auto-injected** when you connect a Blob store; also derives the public Blob URL. **Not used on Docker** (local filesystem driver) |
| `STORAGE_DRIVER` | ◻️ Docker | `vercel-blob` (default) or `local`. The Docker image bakes in `local`; binaries go to `STORAGE_LOCAL_DIR` (default `/app/uploads`) |
| `SITE_URL` | ◻️ Docker | Canonical public URL of the instance (Vercel infers this automatically). Used for OG/sitemap/auth callbacks when self-hosting |
| `CRON_SECRET` | ◻️ optional | Protects `/api/cron` (keep-alive + scheduled backup) — any random string. On Docker the cron sidecar sends it |
| `MCP_OAUTH_SECRET` | ◻️ optional | Signs MCP OAuth codes — random; falls back to `AUTH_SECRET` |
| Turnstile / Facebook keys | ◻️ optional | Comment anti-spam (Cloudflare Turnstile) + Facebook commenter login — **enter these in Admin → Settings** (stored server-side). The matching env vars (`TURNSTILE_*`, `AUTH_FACEBOOK_*`) still work as a fallback |

MCP tokens and the Google Drive backup connection are **created in the admin**, not via env. Secrets stay in `.env.local` (gitignored) + Vercel (`vercel env pull`) — or `.env.docker` when self-hosting; your blog content lives in Supabase + Blob (or the bundled Postgres + local volume on Docker), never in git. The full self-host set is in [`.env.docker.example`](./.env.docker.example).

---

## 🧑‍💻 Run locally (optional)

```bash
git clone https://github.com/joiha-steven/vibeblog.git && cd vibeblog
npm install
cp .env.example .env.local        # fill in the values above
npx auth secret                   # AUTH_SECRET
npm run dev                       # http://localhost:3000/admin
```

Point the same Supabase + Blob at local, and add `http://localhost:3000/api/auth/callback/google` to your Google client. `npm run check:all` must pass before any change is done (typecheck + lint + invariant checks + the vitest seam tests; offline, no creds); `npm run build` for a release.

---

## ⚙️ Using it

- `/` — public blog (published, date-reached posts) · `/category/<slug>`, `/tag/<slug>` (slugified) · header search overlay · path-based pagination (`/page/2`).
- `/admin` — dashboard, editor, media, analytics, settings (owner only).
- **Settings** is one form / one Save, three tabs — **General** (site, menu, reader features, SEO), **Appearance** (palettes, custom font, the per-role text-size table), **Advanced** (MCP, backups, custom CSS). Everything is injected as CSS variables, so changes apply site-wide with **no redeploy**.
- **Performance:** public pages are ISR-cached; every admin save purges exactly the affected pages through one place ([`src/lib/revalidate.ts`](./src/lib/revalidate.ts)), so edits are live next request without ever serving stale. Full design + the *why* in [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## 🗺️ Roadmap

Docker self-host shipped (local filesystem storage); next up: an S3/MinIO storage driver + a published GHCR image, publishing from Markdown note apps (Obsidian → Craft), and optional AI assist in the editor. See [`ROADMAP.md`](./ROADMAP.md).

---

## 📄 License

Two separate layers — keep them distinct:

- **Code (this repo) — [MIT](./LICENSE).** Free and open source: use, modify, redistribute, or sell it for any purpose, **no obligation to credit** (MIT only asks the license text travels with copies of the source). Fork it and run your own blog.
- **Content — © all rights reserved.** The writing published *with* vibeblog (articles, images on an operator's site, e.g. manhhung.me) belongs to its author, is **not** covered by MIT, does not live in this repo, and may not be reused without permission.

> In short: the **software** is open for anyone; the **author's writing** is not.
