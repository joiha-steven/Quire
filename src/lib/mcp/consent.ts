// OAuth consent step for the authorize endpoint. The redirect_uri allowlist alone
// does NOT stop account-takeover: /api/mcp/register is public, so an attacker can
// register THEIR OWN client (redirect_uri = attacker host) and then phish the logged-in
// owner into authorize?client_id=<theirs>&redirect_uri=<attacker> — isRedirectAllowed
// passes (it IS registered for that client) and the code would auto-issue to the
// attacker. The owner must therefore SEE the exact client_id + redirect_uri and click
// Approve. A consent page is only meaningful if its POST can't be forged, so the
// approve form carries a CSRF token bound to the OWNER'S SESSION (see csrfToken below):
// an attacker's auto-submitting cross-site POST rides the owner's cookies but cannot
// compute the token, because it's an HMAC over the owner's raw session JWT (httpOnly,
// never exposed to the attacker) + the exact oauth params. SERVER-ONLY.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { getToken } from 'next-auth/jwt'

const secret = (): string => process.env.MCP_OAUTH_SECRET || process.env.AUTH_SECRET || ''

export type OAuthParams = { clientId: string; redirectUri: string; challenge: string; state: string }

// The owner's current session JWT (raw string) — the unguessable, session-bound secret
// the CSRF token is keyed to. Null when not signed in (then no valid token can exist).
// getToken reads the session cookie straight from the request headers (no DB), handling
// every NextAuth cookie-name variant; `secureCookie` matches the `__Secure-` prefix used
// on https. Takes a plain Request so it's testable without a full NextRequest.
async function sessionToken(req: Request): Promise<string | null> {
  const raw = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
    secureCookie: new URL(req.url).protocol === 'https:',
    raw: true,
  })
  return typeof raw === 'string' && raw.length > 0 ? raw : null
}

// HMAC(secret, sessionJwt | clientId | redirectUri | challenge). Binding to the session
// JWT is what makes this CSRF-proof: a forged cross-site POST can replay the owner's
// cookies but cannot read the JWT to recompute this, and the params are pinned so a
// token minted for one client/redirect can't be reused for another.
function computeCsrf(session: string, p: OAuthParams): string {
  const material = [session, p.clientId, p.redirectUri, p.challenge].join('|')
  return createHmac('sha256', secret()).update(material).digest('base64url')
}

// CSRF token to embed in the consent form. Null if the owner has no session (the GET
// handler already requires owner auth before rendering, so this is non-null there).
export async function csrfToken(req: Request, p: OAuthParams): Promise<string | null> {
  const session = await sessionToken(req)
  return session ? computeCsrf(session, p) : null
}

// Constant-time check that a submitted CSRF token matches the current session + params.
export async function verifyCsrf(req: Request, p: OAuthParams, submitted: string): Promise<boolean> {
  const session = await sessionToken(req)
  if (!session || !submitted) return false
  const expected = computeCsrf(session, p)
  const a = Buffer.from(expected)
  const b = Buffer.from(submitted)
  return a.length === b.length && timingSafeEqual(a, b)
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

// Minimal self-contained consent page. Shows the EXACT client_id + redirect_uri the
// owner is about to trust, and an Approve form that POSTs back to the same route with
// the oauth params + the session-bound CSRF token. Deny links to the blog home (NOT the
// redirect_uri) so denial never navigates to the requested host at all and issues no
// code. No external assets, no theme tokens — this is an out-of-band OAuth interstitial,
// not part of the themed site UI.
export function consentPage(p: OAuthParams, csrf: string, denyHref: string): string {
  const hidden = (name: string, value: string): string =>
    `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Authorize MCP connection</title>
<style>
  body{font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1.25rem;line-height:1.5;color:#111}
  h1{font-size:1.25rem} dl{background:#f4f4f5;border-radius:.5rem;padding:1rem;overflow-wrap:anywhere}
  dt{font-weight:600;font-size:.8rem;color:#52525b} dd{margin:0 0 .75rem;font-family:ui-monospace,monospace;font-size:.85rem}
  dd:last-child{margin-bottom:0} .row{display:flex;gap:.75rem;margin-top:1.5rem}
  button,.deny{font:inherit;padding:.6rem 1.1rem;border-radius:.5rem;border:1px solid #d4d4d8;cursor:pointer;text-decoration:none;color:#111}
  button{background:#111;color:#fff;border-color:#111}
  @media(prefers-color-scheme:dark){body{background:#0a0a0a;color:#fafafa}dl{background:#18181b}dt{color:#a1a1aa}
    .deny{color:#fafafa;border-color:#3f3f46}button{background:#fafafa;color:#0a0a0a;border-color:#fafafa}}
</style></head>
<body>
  <h1>Authorize MCP connection</h1>
  <p>An application is requesting access to operate this blog on your behalf. Approve only if you recognize it.</p>
  <dl>
    <dt>Client ID</dt><dd>${esc(p.clientId || '(none)')}</dd>
    <dt>Redirect URI</dt><dd>${esc(p.redirectUri)}</dd>
  </dl>
  <div class="row">
    <form method="POST">
      ${hidden('client_id', p.clientId)}${hidden('redirect_uri', p.redirectUri)}
      ${hidden('code_challenge', p.challenge)}${hidden('state', p.state)}${hidden('csrf', csrf)}
      <button type="submit">Approve</button>
    </form>
    <a class="deny" href="${esc(denyHref)}">Deny</a>
  </div>
</body></html>`
}
