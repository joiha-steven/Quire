// Serving the browser bundles.
//
// Each bundle is imported as TEXT, which means `bun build --compile` embeds it in the
// binary and the server needs no files beside it. The URL carries a content hash, so the
// response is `immutable` for a year and a deploy that changes the code changes the URL:
// no cache busting to remember, and no reader stuck on a stale script.

import coreJs from '@/assets/dist/core.js' with { type: 'text' }
import postJs from '@/assets/dist/post.js' with { type: 'text' }
import loginJs from '@/assets/dist/login.js' with { type: 'text' }
import { PUBLIC_CSS } from '@/web/public.css'

/** Bundles by logical name. Adding one is an import and a line. */
const BUNDLES: Record<string, string> = { core: coreJs, post: postJs, login: loginJs }

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

/**
 * The public stylesheet, on the same hashed-and-immutable footing as the bundles.
 *
 * It used to be inlined into every page, which buys one less round trip on a COLD visit
 * and charges for it on every visit after. Measured 2026-07-29: of the 48.7 KB assembled
 * per page, 42.6 KB (13.8 KB gzipped) is this sheet and is byte-identical everywhere,
 * while only 6.1 KB (1.7 KB gzipped) actually varies with the owner's settings. Reading
 * three articles re-sent 41 KB of gzipped CSS for one page's worth of information.
 *
 * So the STATIC half moves here and is cached for a year, and the settings half stays
 * inline. The cascade is unchanged because the link is emitted before that inline block,
 * which is where the sheet sat in the assembled string.
 */
export const PUBLIC_SHEET = `/assets/site.${hashOf(PUBLIC_CSS)}.css`
BY_PATH.set(PUBLIC_SHEET, PUBLIC_CSS)

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
