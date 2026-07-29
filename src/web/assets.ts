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

/**
 * A stylesheet request whose hash this build does not know — answered with the CURRENT
 * sheet rather than a 404.
 *
 * The reader did not invent that URL. HTML is `s-maxage=60, stale-while-revalidate=600`, so
 * for up to eleven minutes after a deploy a shared cache hands out the PREVIOUS deploy's
 * page, and the only stylesheet it names is one this process no longer has. The strict
 * answer is a 404, and a 404 on the only stylesheet is an unstyled site — which is a worse
 * failure than a page rendered with CSS one deploy newer than its markup.
 *
 * Only the sheet. A stale JS bundle is a genuine mismatch: it can call into markup that
 * moved, and silently doing nothing is better than doing the wrong thing. CSS degrades the
 * other way round.
 *
 * `immutable` stays honest through this. A client asking for an old hash is by definition
 * one that has never held those bytes, and once it loads any fresh page it moves to the
 * current URL and never asks again — so no client can observe a URL changing under it.
 */
function staleSheet(path: string): string | null {
  return /^\/assets\/site\.[a-z0-9]+\.css$/.test(path) ? PUBLIC_CSS : null
}

/** The bundle served at a request path, or null when nothing matches. */
export function assetBody(path: string): string | null {
  return BY_PATH.get(path) ?? staleSheet(path)
}
