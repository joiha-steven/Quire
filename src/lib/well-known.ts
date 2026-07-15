// Shared helpers for the /.well-known agent-discovery documents (MCP Server Card,
// API Catalog, OAuth metadata …). Agents fetch these cross-origin, so every one
// answers CORS preflight and sends permissive CORS; a small `public` cache-control
// lets a CDN in front (Cloudflare) cache them sanely instead of applying a
// heuristic TTL to an un-hinted response. The origin comes from mcp-handler's
// getPublicOrigin so these match the OAuth metadata routes exactly.
import { getPublicOrigin } from 'mcp-handler'
import pkg from '../../package.json'

export const APP_VERSION: string = pkg.version

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export function wkOptions(): Response {
  return new Response(null, { status: 204, headers: CORS })
}

// A discovery document: pretty JSON, permissive CORS, cacheable for an hour.
export function wkJson(body: unknown, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status: 200,
    headers: { ...CORS, 'content-type': contentType, 'cache-control': 'public, max-age=3600' },
  })
}

export { getPublicOrigin }
