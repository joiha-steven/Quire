> Split from CLAUDE.md — the agent-discovery surface: what Quire exposes so AI agents
> can find, read, and drive the site (the standards behind Cloudflare's "Is Your Site
> Agent-Ready?" scan). MCP internals → [`mcp.md`](./mcp.md); SEO/feeds → [`seo-pwa.md`](./seo-pwa.md).

# Agent-ready surface

Quire is built around two things agents want: **content authored in Markdown** and a
**working MCP server** (`/api/mcp`, Streamable HTTP, OAuth 2.0 + PKCE). The endpoints
below advertise and expose those; most are thin route handlers that describe what
already exists.

## Endpoints

| Path | What | Route |
|---|---|---|
| `/[slug]` + `Accept: text/markdown` | Post/page as raw **Markdown** (the source, not a conversion). Browsers (Accept: text/html) get HTML unchanged. | `next.config.ts` rewrite → `api/md/[slug]/route.ts` |
| `/.well-known/mcp/server-card.json` | MCP Server Card: serverInfo, transport endpoint, auth pointers | `app/.well-known/mcp/server-card.json/route.ts` |
| `/.well-known/api-catalog` | API Catalog (RFC 9727, `application/linkset+json`) → MCP + card + llms + health | `app/.well-known/api-catalog/route.ts` |
| `/.well-known/oauth-authorization-server` | OAuth AS metadata (RFC 8414) | `app/.well-known/oauth-authorization-server/route.ts` |
| `/.well-known/oauth-protected-resource` | OAuth protected-resource metadata (RFC 9728) | `app/.well-known/oauth-protected-resource/route.ts` |
| `/auth.md` | Human/agent-readable auth + registration guide (Markdown) | `app/auth.md/route.ts` |
| `/robots.txt` | Bot policy **+ `Content-Signal`** (contentsignals.org) | `app/robots.txt/route.ts` |
| Homepage `Link:` header | RFC 8288 links → api-catalog, MCP card, llms, sitemap, feed | `next.config.ts` `headers()` |
| `/llms.txt` `/sitemap.xml` `/feed.xml` | Content index / sitemap / RSS (SEO features) | see `seo-pwa.md` |

Shared helpers for the `.well-known` JSON docs (permissive CORS + cacheable JSON +
`APP_VERSION`) live in `lib/well-known.ts`. New public read routes must be allow-listed
in BOTH `middleware.ts` (`isPublicApi`) and `scripts/checks/routes-guarded.mjs`.

## ⚠️ Reverse-proxy requirement — `/.well-known/*` must reach the app

The OAuth/MCP discovery routes are served by Next, so a proxy in front MUST forward
`/.well-known/*` to the app, not serve it from disk. A CloudPanel/nginx vhost ships a
`location ~ /.well-known { … }` block (for ACME) with **no `proxy_pass`** — it swallows
ALL `/.well-known/*` and returns a disk 404, so discovery silently breaks. Narrow it to
`location ^~ /.well-known/acme-challenge/` so everything else falls through to the
proxy. (Also purge the CDN once — a cached 404 outlives the fix.) See the deploy notes
in the ops repo / memory.

## Content-usage policy (Content-Signal)

`robots.txt` declares `search=yes, ai-train=yes, ai-input=yes` — matching the existing
AI-friendly stance (the AI bots are allow-listed and `/llms.txt` is served). It's a
constant in `app/robots.txt/route.ts`; change it there if the policy should differ (or
promote it to a setting when per-instance control is wanted).

## Not implemented (deliberate)

Emerging/low-fit standards left out, with the reason — revisit if a real agent needs one:
- **DNS-AID** (DNS SVCB discovery records) — infra, not code: publish `_index._agents`
  / `_a2a._agents` SVCB records at the DNS provider (Cloudflare) + DNSSEC.
- **Agent Skills index**, **A2A Agent Card**, **WebMCP** — the MCP server already covers
  agent tool-use; these are early specs (unstable schemas / Chrome-only) that don't map
  cleanly onto a blog. The MCP Server Card is the stable equivalent.
- **Web Bot Auth** (HTTP message-signature verification) — niche; adds request-signing
  verification with little benefit for public content.
