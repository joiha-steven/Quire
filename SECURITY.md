# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for security problems.**

Report privately through GitHub's **[Report a vulnerability](https://github.com/joiha-steven/Quire/security/advisories/new)**
(Security → Advisories on this repo). If that is unavailable, open a minimal public
issue asking a maintainer to make private contact — without any exploit detail.

Include what you can: affected version/commit, a description, reproduction steps or a
proof of concept, and the impact you foresee. We aim to acknowledge within a few days
and to ship a fix or mitigation before any public disclosure.

## Scope

Quire is self-hosted, single-owner software. The trust model: the authorized owner
(`AUTHORIZED_EMAIL`) is trusted — owner-only actions (uploading media, editing content,
custom CSS/SVG) are not vulnerabilities. Reports we care about include:

- Anything reachable **without** an owner session that reads or writes owner data,
  bypasses `requireOwner()` / the middleware guard, or forges an MCP/OAuth token.
- Injection (SQL/PostgREST filter, path traversal out of the store), SSRF, or stored
  XSS reachable by a **non-owner** (reader comments, public pages, OG).
- Secret exposure to the client (service key, Drive token, Turnstile/integration keys).

## Supported versions

Fixes land on `main` and the latest release. Please test against the latest `main`
before reporting.
