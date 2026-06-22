> Split from CLAUDE.md — read when touching the MCP server (`/api/mcp`, `src/lib/mcp/`), its tokens, or the OAuth flow.

# MCP server — `/api/mcp` + `src/lib/mcp/`

- **What it is.** A remote MCP endpoint (Streamable HTTP, `mcp-handler` + `@modelcontextprotocol/sdk`)
  that lets an MCP client (Claude/ChatGPT) operate the blog. Tools are THIN wrappers over the same
  `lib/` functions the admin routes use — same slug rules, revisions, soft-delete, revalidation,
  activity log. **Off unless the owner enables it** (Admin → Settings → Advanced toggle,
  `settings.mcp.enabled`); `verifyMcpToken` 401s every call while off.
- **Auth = admin-managed tokens + thin OAuth.** Manual tokens are created in the admin (up to 5,
  named, shown ONCE on creation — only the SHA-256 hash is kept in the `mcp_tokens` table; see
  `lib/mcp/tokens.ts`). Every token **expires 180 days after creation** (`expires_at`, set on insert,
  default in `schema.sql`); `verifyMcpToken` hashes the bearer, looks it up, **rejects it once past
  `expires_at`**, else stamps `last_used_at` (while the toggle is on). There is **no `MCP_TOKEN` env
  var.** Connectors that require OAuth run a minimal OAuth 2.1 authorization-code + PKCE flow gated by
  the owner's NextAuth login (`src/app/api/mcp/{authorize,token,register}` + `src/app/.well-known/oauth-*`);
  the `/token` exchange **mints a 180-day token via `mintOAuthToken`** (named "OAuth connector") and
  returns it. **OAuth tokens are exempt from the manual 5-cap and are NEVER auto-deleted** (an expired
  row lingers as dead until the owner deletes it; a connector silently re-authorizes to mint a fresh one).
  **Lifecycle rule: the admin is the SOLE authority over a connection** — beyond the 180-day expiry a
  token persists (no prune) until the OWNER deletes it in the admin; deleting the connector in Claude
  alone just lets it re-authorize (a new token). So authorize once = stays connected (connector
  re-auths across the 180-day boundary), and an admin delete is final unless the owner re-authorizes.
  (A reconnect mints a new row; the prior one persists until the owner removes it — the admin
  lists/deletes them all.) Codes are HMAC-signed
  (`MCP_OAUTH_SECRET` → falls back to `AUTH_SECRET`) in `lib/mcp/auth.ts`. Token CRUD: owner-only
  `/api/mcp/tokens` (+ `/[id]`); UI in `components/admin/McpFields.tsx` (cap counts manual only).
- **Tools** (`lib/mcp/tools.ts` posts/pages/taxonomy, `tools-library.ts` media/files/settings;
  results via `result.ts`). Content is Markdown verbatim — no HTML conversion. Deletes are soft
  (→ Trash). **`update_settings` exposes only a safe allowlist (title/description/showDescription)** —
  the zod inputSchema IS the allowlist, so sensitive settings can't be written over MCP. `get_settings`
  reads all. **Adding a tool that mutates → revalidate + `logActivity` like the admin routes.**
