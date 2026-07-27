// Serving the browser bundles.
//
// Each bundle is imported as TEXT, which means `bun build --compile` embeds it in the
// binary and the server needs no files beside it. The URL carries a content hash, so the
// response is `immutable` for a year and a deploy that changes the code changes the URL:
// no cache busting to remember, and no reader stuck on a stale script.

import postJs from '@/assets/dist/post.js' with { type: 'text' }

/** Bundles by logical name. Adding one is an import and a line. */
const BUNDLES: Record<string, string> = { post: postJs }

/**
 * Short content hash. Not a security boundary, so speed matters more than collision
 * resistance: `Bun.hash` over the source is enough to change the URL whenever the bytes
 * change, which is the entire job.
 */
const hashOf = (source: string): string => Bun.hash(source).toString(36).slice(0, 10)

const PATHS = new Map<string, string>()
const BY_PATH = new Map<string, string>()
for (const [name, source] of Object.entries(BUNDLES)) {
  const path = `/assets/${name}.${hashOf(source)}.js`
  PATHS.set(name, path)
  BY_PATH.set(path, source)
}

/** The hashed URL for a bundle. Callers use this rather than writing paths by hand. */
export function assetPath(name: keyof typeof BUNDLES & string): string {
  const path = PATHS.get(name)
  if (!path) throw new Error(`assetPath: no bundle named ${JSON.stringify(name)}`)
  return path
}

/** A `<script>` tag for a bundle. `defer` because no island needs to block parsing. */
export function scriptTag(name: string): string {
  return `<script src="${assetPath(name)}" defer></script>`
}

/** The bundle served at a request path, or null when nothing matches. */
export function assetBody(path: string): string | null {
  return BY_PATH.get(path) ?? null
}
