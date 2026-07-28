// Prerender the next page on hover. The largest perceived-speed win available to a reading
// site, and it costs no runtime JavaScript: the browser does the work, on its own budget,
// and a click then paints a document that is already rendered.
//
// The spec asked for this (docs/spec/04-frontend.md, "two zero-JavaScript wins") and
// docs/performance.md described it as already shipping. It was not: the port carried over
// `whenActivated` — the guard that exists ONLY because a prerendered page runs its JS at
// speculation time — and never the rules that make the guard necessary.
//
// **Delivered as a header, not as an inline script.** The frozen tree put ten lines of JSON
// in the head. 2.0 ships no inline script on the public site, which is what lets the
// recommended CSP omit `unsafe-inline` from `script-src`, and an inline speculationrules
// block is governed by `script-src` like any other. The `Speculation-Rules` response header
// points at a JSON document instead, so the invariant holds and the CSP stays clean.

/** The path the header points at. Same-origin is a requirement of the header, not a choice. */
export const SPECULATION_PATH = '/speculation-rules.json'

/** `Speculation-Rules: "/speculation-rules.json"` — the quotes are part of the grammar. */
export const SPECULATION_HEADER = `"${SPECULATION_PATH}"`

/**
 * `moderate` is hover, and it is the safe default.
 *
 * `eager` prerenders links merely in the viewport, which on a listing page is every card:
 * a reader who scrolls past ten posts would have paid for ten renders. Hover is a real
 * signal of intent, and it arrives early enough to matter.
 *
 * The exclusions are the paths where a speculative GET is not free. `/admin` and `/api` do
 * work and can write; `/preview` burns a token; `/og` renders an image; `/uploads` is bytes
 * nobody asked for. `nofollow` and `download` are the author saying so in the markup.
 */
const RULES = {
  prerender: [
    {
      where: {
        and: [
          { href_matches: '/*' },
          { not: { href_matches: ['/admin/*', '/api/*', '/uploads/*', '/preview/*', '/og*'] } },
          { not: { selector_matches: '[rel~=nofollow]' } },
          { not: { selector_matches: '[download]' } },
        ],
      },
      eagerness: 'moderate',
    },
  ],
}

const BODY = JSON.stringify(RULES)

/**
 * The rules document.
 *
 * Its own content type — `application/speculationrules+json` — and browsers refuse it under
 * any other, so this is not a formality. Cached hard: it changes only when this file does,
 * and a reader who fetches it once should never fetch it again.
 */
export function speculationRules(): Response {
  return new Response(BODY, {
    headers: {
      'content-type': 'application/speculationrules+json',
      'cache-control': 'public, max-age=86400',
    },
  })
}
