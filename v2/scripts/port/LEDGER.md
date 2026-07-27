# Port ledger

Every file moved from the frozen tree, and every one deliberately left behind. Kept so a
module cannot be dropped silently: `v2/docs/07-parity.md` covers behaviour, this covers
files.

Closed milestones are split out as they finish, so this file stays the CURRENT one:

| Milestone | File |
|---|---|
| M1, the data layer | [LEDGER-M1.md](LEDGER-M1.md) |
| M2, the public renderer | this file |

## M2 begins: the renderer, and the byte-identical gate held (2026-07-27)

| Destination | From | Change |
|---|---|---|
| `render/highlight.ts` | `highlight.ts` | Same Shiki call, now behind the content-addressed `render_cache` |
| `render/post-content.ts` | `components/blog/PostContent.tsx` | Every transform byte-for-byte the same. The ONLY change is the return: a React server component ending in `dangerouslySetInnerHTML` becomes a function returning the HTML string |
| `render/post-content.test.ts` | `components/blog/post-content.test.ts` | 22 assertions unchanged; only the two-line `render()` helper adapted |

**`marked` and `shiki` are pinned to EXACT versions (18.0.5, 4.2.0), no caret**, matching
what the frozen tree resolves. A byte comparison against a floating dependency fails on a
patch release and teaches everyone to ignore it.

### The golden harness

45 hand-written markdown fixtures in `golden/corpus/`, covering the list in 03-golden.md:
nested lists, lists containing code and tables, lazy continuation, setext headings,
emphasis against Vietnamese diacritics and punctuation, intraword underscores, raw HTML
(Invariant 5), `javascript:`/`data:`/`vbscript:` hrefs including a tab-obfuscated one,
reference links with a missing target, footnotes defined before and after their reference,
duplicates and orphans, GFM alignment and escaped pipes, task lists, three fence cases,
hard breaks, entities, callouts, video URLs, image alignment and grids, a 900-character
line, CRLF, a BOM, and a file with no trailing newline.

**The reference HTML was produced by running the frozen renderer, not written by hand.**
`golden/capture-corpus.ts` imports `../../src/components/blog/PostContent` by relative path
and runs it under Bun; nothing in the frozen tree is written to. Hand-written expectations
would only test that the port was transcribed consistently with itself, which is the thing
least worth testing.

**Result: 46/46 byte-identical**, including the fenced-code fixtures, which means Shiki's
output through the new cache matches Shiki's output without it.

`golden/v1/corpus/` is committed and is the CONTRACT. Regenerating it is a reviewed change:
if 2.0 starts producing different markup, the fix is 2.0.

### A mistake worth recording

`bun add marked shiki hono` was run with the working directory at the repository root, so
it edited the FROZEN tree's `package.json` and bumped `marked` 18.0.5 to 18.0.7 and `shiki`
4.2.0 to 4.3.1. Reverted with `git checkout`. It also produced the useful fact above: the
frozen tree pins older versions than `bun add` would pick, and matching them exactly is a
precondition for the gate.

## M2: the server exists and serves an article (2026-07-27)

| File | Role |
|---|---|
| `src/env.ts` | PORT / DATA_DIR / SITE_URL, validated at boot |
| `src/index.ts` | Boot: open databases, serve, flush analytics on SIGINT/SIGTERM |
| `src/web/app.ts` | The public router. Article route + the page cache |
| `src/web/layout.ts` | The HTML shell. Inline CSS, language-chosen font preloads, no script tag |
| `src/web/public.css.ts` | The hand-written public sheet (ADR 0008) |

Measured on a real server, not reasoned about:

```
cold request   256 ms   (includes Shiki's one-time WASM init)
warm requests  2-4 ms   (page cache hit)
page weight    9,042 bytes, ZERO script tags, ZERO stylesheet requests
```

**A CSS bug the browser found and reading could not.** `applyFootnotes` already emits
`<hr class="fn-rule">`, and the new sheet also put a `border-top` on `.footnotes`, so two
rules were drawn above the notes. Invisible in the markup, obvious in a screenshot. The
frozen tree styles `.fn-rule` and leaves `.footnotes` borderless; the sheet now matches.

**A second one the runtime found.** The comment fixing it used backticks around
`applyFootnotes`, inside a template literal, which terminated the string. The server
refused to boot, which is the right failure. Comments inside `PUBLIC_CSS` use no backticks.

14 router tests run over real HTTP against a real database. Two of them are the ones worth
having: an article page contains no `<script`, and a draft, a future-dated post and a
trashed post all 404 rather than leaking.

Still to come in M2: listings, taxonomy, series, search, feeds, OG images, and the 23
islands as vanilla JS.

## M2: every public route (2026-07-27)

| File | Role |
|---|---|
| `src/web/article.ts` | The `/{slug}` page, split out of the router so the router stays a routing table |
| `src/web/listing.ts` | ONE renderer for home, pagination, category, tag, series and search |
| `src/web/feeds.ts` | RSS, sitemap, robots, llms.txt |

Routes live: `/`, `/page/:n`, `/category/:slug(/page/:n)`, `/tag/:slug(/page/:n)`,
`/series/:slug`, `/search`, `/feed.xml`, `/sitemap.xml`, `/robots.txt`, `/llms.txt`,
`/{slug}`. Measured on the running server, and **every HTML route contains zero
`<script`**.

**A bug the test found, and it was an SEO one.** `paginate` CLAMPS an out-of-range page, so
checking "did this page come back empty?" never fired: `/page/9` of a two-page blog served
page two, under a ninth URL, and so would every number a crawler tried. Duplicate content
at unbounded URLs. The check compares against `totalPages` now.

Three deliberate decisions:

- **Search is not cached.** Its key would be the query string, which is unbounded, so a
  cache any anonymous visitor can fill is a memory leak with a nicer name. FTS5 makes the
  read cheap enough not to need one.
- **A disabled feed 404s** rather than serving an empty document. An empty feed looks like
  a broken site to an aggregator; a 404 looks like what it is.
- **Pagination is prev/next, not numbered.** Deep page numbers are navigation nobody uses
  and every one is a URL a crawler walks. A simplification, recorded rather than silent.

A series page is not paginated: it is read front to back.

## Moved, then pulled back out

| File | Why |
|---|---|
| `prerender.ts` | Copied into `server/` by mistake. It is BROWSER code (the `whenActivated` guard that stops a prerendered page firing analytics beacons, shipped to the frozen tree in M0). In 2.0 the public islands are hand-written vanilla in `assets/js/`, so this becomes part of `core.js` during M2. It does not belong in a server module and its DOM globals do not typecheck there. |

## Not moved yet, and why

| Module | Reason |
|---|---|
| `db` | Replaced by `store/db.ts` (`bun:sqlite`) |
| `auth`, `api` | Replaced: `next-auth` goes (ADR 0007), `next/server` becomes Hono |
| `gdrive`, `backup`, `backup-state` | Google Drive replaced by litestream (parity exception 1) |
| `image`, `highlight`, `wordpress-import`, `well-known` | Need npm dependencies (`sharp`, `shiki`, `turndown`, MCP SDK). Land with their module |
| `upload-client` | Browser-side; belongs to the admin SPA |
| `mcp/auth`, `mcp/consent`, `mcp/tools`, `mcp/tools-library`, `well-known` | Route-shaped, not data-layer: they need the MCP SDK, zod and the router. M3. (`og.ts` turned out to touch no `db()` at all and moved verbatim in the first slice.) |


## M2: the first islands, hand-written (2026-07-27)

| File | Role |
|---|---|
| `src/assets/js/core.ts` | `whenActivated`, `label`, `el`, `onScrollFrame`. Bundled in, never served alone |
| `src/assets/js/{back-to-top,code-copy,lightbox}.ts` | Three islands, one file each |
| `src/assets/js/post.ts` | The `/{slug}` bundle: imports the three and calls them |
| `scripts/build-assets.ts` | Bundles `js/` into `dist/`, ahead of time |
| `src/web/assets.ts` | Imports the bundle as TEXT, hashes it, serves it |

**2,966 bytes, minified, for the whole article page.** One request, `defer`, cached
`immutable` for a year under a content-hashed URL. The listing, taxonomy, series, search
and feed routes still contain zero `<script`.

**Why the bundle is built ahead of time.** `bun build --compile` produces one binary with
no source tree beside it, so a runtime `Bun.build` would work in development and fail in
production. The server imports the finished bundle with `with { type: 'text' }`, which the
compiler embeds.

**Two of the four were deleted rather than ported**, which is what 04-frontend.md called
for and I nearly missed:

- **`ReadingProgress` is now CSS.** `animation-timeline: scroll(root block)` on a
  server-rendered bar. No script, no scroll listener, no main-thread work, and it works
  with JavaScript switched off. An `@supports` guard removes the element entirely on an
  engine without scroll timelines, so the failure mode is absence rather than a hairline
  stuck at zero. `features.progressBar` still decides whether the markup exists at all.
- **`Lightbox` is a `<dialog>`.** Escape, focus trapping, the inert background and the
  backdrop are the browser's job now, not this file's. What is left is the picture and the
  arrows. Navigating swaps the image inside the dialog rather than rebuilding it, because
  rebuilding drops focus and re-runs `showModal` on every arrow press.

I wrote both as JavaScript first, as a straight port of the React components, and caught it
only on re-reading the spec. Worth recording: the porting rule says move it, do not improve
it, but the spec had already decided these two were to be **deleted**. Applying the porting
rule past the plan is not discipline.

**The rest became one bundle, deliberately.** The frozen tree mounted each behind a
server-side condition (`content.includes('```')`, `imageUrls.length > 0`). Here each part
guards itself on the markup it needs, so a post with no code and no images downloads the
same file and runs two queries that find nothing. A transport change, not a behaviour
change: the frozen tree split them because React's per-island cost was real, and this whole
bundle is smaller than one of those islands was.

**No locale table crosses the wire.** Every string an island shows is translated on the
server and handed over as a `data-` attribute on `<body>`. The bundle has no language of
its own and cannot disagree with the page it is running on.

**The DOM boundary is now type-checked, not remembered.** `src/assets/js/` has its own
tsconfig with `lib: ["DOM"]`, and the root project excludes it and has no DOM lib. A server
module that reaches for `document` fails to compile. `check:all` runs both projects.

**The islands have tests, which is new.** Browser code is the one part `bun test` cannot
reach by making a request, so until now the only evidence any of it ran was that the
bundler accepted the syntax. 14 tests drive them against happy-dom: the copy button is
idempotent and reverts its label, the lightbox wraps at both ends, tears down on `close`
however it was closed, and reopens cleanly. happy-dom is registered for that ONE file and
unregistered in `afterAll` — registering globally would hand the router tests happy-dom's
`fetch` and `Response` instead of Bun's.

Measured on the running server: article page one script, body carrying six `data-` labels,
unknown asset hash 404s, home page zero scripts.

*Caveat worth stating: happy-dom is not Chromium. These tests prove the logic, not that
`showModal` and scroll-driven animations behave identically in a real engine.*

**Two Windows traps, both fatal, both silent about the real cause.**
`new URL('..', import.meta.url).pathname` yields `/C:/dev/...`, and every filesystem call
against it fails with `EFAULT: bad address`. `fileURLToPath` is the fix. And for the second
time, **a backtick inside a comment in `public.css.ts` ended the template literal** and the
server refused to boot. The file now carries a note saying so.

Still to come in M2: the analytics beacon (`core.js` + `POST /api/track`), OG images,
search/subscribe/comments overlays, book mode, and the listing islands.

## M2: the analytics beacon (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/track.ts` | `app/api/track/route.ts` | `POST /api/track`, always 204 |
| `src/assets/js/track.ts` | `Track.tsx` + `ScrollDepth.tsx` | The beacon, both halves in one file |
| `src/assets/js/activation.ts` | `lib/prerender.ts` | `whenActivated`, alone in its own module |
| `src/assets/js/core.ts` | new | The bundle every public page loads |

**core.js is 1,162 b; post.js is 2,966 b.** A listing pays for the first only; an article
pays for both. Both numbers are now enforced: `build-assets.ts` fails the build over
budget, so adding a feature either fits or moves a number in a diff someone reads. A
JavaScript budget nobody defends is not a budget, and the frozen tree's 143 KB of framework
is what that looks like after two years.

**Every public page carries the beacon**, which is why `core.js` exists at all. A pageview
that only fired on posts would undercount the home page, every listing and every taxonomy
page, which between them are most of a blog's traffic. Listings had zero `<script` before
this commit and now have one; the router test was changed to say so rather than deleted.

**`whenActivated` got its own module because the bundler shakes per module, not per
export.** Sitting beside the DOM helpers it rode into `post.js`, where nothing calls it —
182 bytes for a prerender guard on a page that has no beacon. Splitting it also took
`core.js` from 1,602 b to 1,162 b, since the beacon does not need `el` or `onScrollFrame`.
Found by grepping the built bundle for `prerendering`, not by reading the source.

**`Track` and `ScrollDepth` merged into one file.** They were two React components because
they mounted at different points in the tree; as plain functions they share a path, a
beacon helper and an activation guard, and splitting them would duplicate all three.

**One behaviour is deliberately NOT ported yet, and is written down rather than left to be
noticed.** The frozen handler opens with `if (await requireOwner()) return 204`, so an
owner reading their own blog is never counted. 2.0 has no session to ask until M3. Recorded
in `docs/07-parity.md` §8 and in a comment at the top of `track.ts`.

**A test assertion that was wrong about its own subject.** The flood test counted the
buffer and expected 240; it got 40, because the buffer flushes itself at `MAX_ROWS` (that
is Invariant 7 working). It counts the table now.

Driven against the running server, not just `app.request`: one view with
`referrer_host=news.ycombinator.com`, `device=desktop`, `browser=Chrome`, `os=Windows`; one
scroll row at `depth=83`, `dwell_ms=45000`; a Googlebot beacon dropped; and the visitor
column holding a hash with neither the IP nor the user-agent anywhere in the row.

## M2: OG cards, and the route that serves every image (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/render/og-card.ts` | `app/og/route.tsx` | The 1200x630 card, satori + sharp |
| `src/render/fonts/*.woff` | `app/og/*.woff` | Three Inter subsets, embedded in the binary |
| `src/web/og.ts` | same route's handler half | `GET /og`: query parsing, the SSRF guard, caching |
| `src/web/uploads.ts` | `app/uploads/[...path]/route.ts` | `GET /uploads/*`: streamed, range-capable |

**`next/og` was satori plus a WASM rasteriser; this is satori plus sharp**, which was
already a dependency and already rasterises SVG. One new package (`satori`) rather than
two. The element tree is built as plain objects instead of JSX, so this file does not need
a different JSX pragma from the rest of the codebase.

**A background image has to be INLINED as a data URI.** satori emits `<image href="...">`
and hands the SVG to sharp, which does not fetch remote references. Passing the URL
through produces a card with the gradient and no picture: a valid PNG, a silent failure,
and the sort of thing that is discovered on Twitter.

**The bug that only a screenshot could find.** satori ignores `inset: 0`, so the dark
overlay collapsed to zero height and the first working card was white text on bright orange
at 55% opacity: unreadable. It returned 200, it was a valid 1200x630 PNG, and every
structural assertion passed. Both layers now carry explicit `top`/`left`/`width`/`height`,
and a test compares the brightness of the top and bottom strips so the wash cannot vanish
again.

**Two ways to measure a picture wrongly, both of which return a confident number.**
`sharp(...).extract(...).stats()` computes on the INPUT image and ignores the pipeline, so
every strip of the card reported the same value. And the fourth channel is alpha, a flat
255, which drags every average toward white. Both are written down in the test helper.

A third: "the card is not blank" first compared two strips of ONE card, which measures the
diagonal base gradient rather than the type. It compares the same strip across a titled and
an untitled card now.

**`GET /uploads/*` was missing entirely**, which meant every image in a rendered post, every
featured image and every OG background resolved to a 404. Found while wiring the card's
background, not by a test. Ported near-verbatim, including single byte-range support: video
seeking needs 206 responses and iOS Safari will not play a video at all without them.

**A security test that passed without testing anything.** `/uploads/../../package.json` is
normalised by the URL parser before the router sees it, so the handler never ran. The
traversal cases are percent-encoded now, so they arrive intact and `resolveSafe` is what
has to reject them.

**`blob-local` resolves its root once, at module load.** Setting `STORAGE_LOCAL_DIR` from a
test is too late, because the import is hoisted. The upload test asks the driver where the
store is via `resolveSafe` and creates one directory inside it.

Open Graph and Twitter tags now exist at all: the shell had none. `summary_large_image`
only when there is an image, because with that card type and no image X stretches the site
favicon across it.

Also corrected: a `site ? ... : undefined` guard around the card URL was dead code, since
`resolveSiteUrl` falls back to `SITE_URL` and then to localhost. The comment claiming
otherwise was worse than no comment. The test that asserted the dead branch now asserts
what actually happens.

## M2: the machine surfaces, and the files nobody was serving (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/markdown.ts` | `api/md/[slug]/route.ts` | The post as its authored Markdown |
| `src/web/manifest.ts` | `app/manifest.ts` | The PWA manifest, from live settings |
| `src/web/preview.ts` | `(blog)/preview/[slug]/page.tsx` | Tokened draft preview |
| `src/web/search-api.ts` | `api/search/route.ts` | `GET /api/search`, metadata only |
| `src/web/static.ts` | `public/` | Fonts, favicon, app icon, embedded in the binary |
| `src/web/api.ts` | `lib/api.ts` (partly) | `json` / `fail`, and the request logger |

**Content negotiation moved out of `next.config.ts` and into the router.** The frozen tree
rewrote `/:slug` to `/api/md/:slug` when the request carried `Accept: text/markdown`, in a
config file three directories away from the route it affected. It is now four lines in the
`/:slug` handler, next to the thing it changes. Both URLs still work.

**Request logging is middleware, not a call in every handler.** The frozen tree ended each
handler with `logRequest(req, status, start)`, including inside every early return, so the
rule was kept by remembering it and the failure mode was a route that silently logged
nothing. Now a request is logged because it went through the router. Same reasoning as
Invariant 4 gating writes by router-group membership rather than by a per-handler check.

**`public/` was never served, and that was worse than it sounds.** Every page emits
`<link rel="preload" href="/fonts/inter-latin.woff2">` and nothing answered it: the site's
reading font never loaded, so the entire typography system was decorative. Same for
`/app-icon.png` and `/favicon.ico`. Found by requesting the URLs after the manifest landed,
not by any test. 21 fonts, the favicon and the app icon are now imported with
`with { type: 'file' }` and listed BY NAME, because there is no glob import the compiler
can follow and a font missing from that list works in development and 404s in production.
Next's scaffolding SVGs were deliberately left behind.

**The sharp risk escalated from "images fail" to "the server will not start", and is now
back to "one route fails".** `bun build --compile` bundles sharp's JavaScript but not its
native module. That was recorded in M1 as a first-image-call failure. Adding the OG card
put sharp on the boot path, and the compiled binary died at startup — a blog that serves
nothing because it cannot draw a social card. Two static imports were the cause, and the
second was not obvious: `content/settings.ts` imports `renderLogo` from `media/files.ts`,
and settings is on every request. Both are now `await import('sharp')` at the point of use.

Measured on the COMPILED binary, run from a directory containing nothing but the exe:

```
/                                  200  12,224 b
/fonts/inter-latin.woff2           200  36,116 b
/fonts/literata-vietnamese.woff2   200   8,652 b
/app-icon.png  /favicon.ico        200
/manifest.webmanifest              200     418 b
/robots.txt                        200
/og?title=Test                     500   (logged; the packaging decision is M4's)
```

That is the failure shape worth having: the blog works, one route does not, and the log
says why.

**Ported as-is, and wrong:** the preview banner is a hardcoded Vietnamese string in the
frozen tree, which breaks 2.0's rule that UI strings live in `src/i18n` in all six
languages. Moved verbatim here per the porting rule; fixed in the next commit.

## M2: the two things a reader can write to (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/comments.ts` | `api/comments/route.ts` | Read the tree, post a comment |
| `src/web/newsletter.ts` | `api/subscribe` + `api/newsletter/{confirm,unsubscribe,open}` | The whole sign-up path |
| `src/assets/js/comments.ts` | `Comments` + `CommentForm` + `CommentsLazy` | One island instead of three |
| `src/assets/js/subscribe.ts` | `SubscribeForm` | Enhancement, not the only path |

**core.js 1,162 b; post.js 6,700 b** against a budget raised from 4,000 to 8,000. The
budget moving is the point: it moved in a diff.

**PARITY EXCEPTION: Google sign-in is gone, so the trusted-commenter path is gone.** The
frozen tree had two identities. A commenter signed in with Google was trusted — name and
email came from the session and Turnstile was skipped — and everyone else filled in a form.
ADR 0007 removes Google sign-in, so only the manual path survives. A reader who never
signed in loses nothing; one who did now fills in two fields. Recorded in
`docs/07-parity.md`.

**Comments stay client-fetched, and that is not laziness.** The article page is cached HTML
(Invariant 1) and a comment is not a post. Rendering the thread into the page would force a
choice between flushing the entire page cache whenever a stranger types something and
serving a stale thread. Fetching sidesteps both, which is why the frozen tree did it too.
The fetch is held behind an `IntersectionObserver`: a reader who never reaches the bottom
of the article never makes the request.

**DELIBERATE DEVIATION, stated because it is one.** The frozen tree built its sign-up form
in JavaScript, so a reader without it saw no form and lost nothing. 2.0 renders the form
server-side — to keep it out of the JavaScript budget and out of the layout shift — which
means a reader without JavaScript now *can* submit it. Answering that submit with a page of
JSON would be a defect this port created rather than one it carried. So `/api/subscribe`
takes a form post as well as JSON and replies in kind, with the same status code either
way: **400 stays 400**, because the status describes the request, not the presentation.

**PLACEMENT DEVIATION:** the frozen tree put a subscribe TRIGGER in the site header, opening
an overlay. The overlay is still to be ported, and a trigger with nothing behind it is worse
than no trigger, so the form sits at the end of the article for now.

**The XSS boundary is one line either way.** A comment's `contentHtml` goes through
`innerHTML`, which is safe for exactly one reason: the server rendered it through the
limited-markdown sanitiser in `comment-md.ts`. The author NAME goes through `textContent`.
Reversing those two turns a comment section into an XSS on every reader of the post, so
there is a test that puts `<img src=x onerror=…>` in a name and asserts no element appears.

**Three near-misses of my own, all caught by the type checker or a test:**

- I added 15 locale keys that mostly already existed (`commentsHeading`, `commentEmailNote`
  and the rest of the family were there). Duplicate keys in one object literal are a
  compile error, which is the only reason this was not a second, drifting set of strings.
- The two that *were* new got named `subThanks`/`subPending`, ignoring the `nl*` family
  beside them. Renamed `nlInvalid` / `nlNoMail`; `nlPending` was rejected because the admin
  strings already use that name for a subscriber status.
- The test seeded subscribers with `db().run(sql, a, b)`, which types its rest parameter as
  an array OF binding arrays. Same trap `store/query.ts` documents.

Still to come in M2: the search / subscribe / comments OVERLAYS and the header that triggers
them, book mode, the left rail and its table of contents, and the listing islands (grid
toggle, infinite scroll).

## M2: the site chrome, and search without a page load (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/web/chrome.ts` | `(blog)/layout.tsx` | The header and footer, shared by both renderers |
| `src/assets/js/search.ts` | `SearchTrigger` + `SearchOverlay` + `SearchClient` | One island instead of three |
| `src/assets/js/test-dom.ts` | new | The happy-dom harness the island tests share |

**core.js 3,849 b / 5,000; post.js 5,999 b / 8,000.** `subscribe` moved from `post` to
`core`, because the sign-up form now lives in the footer of every page rather than at the
end of an article.

**The header and footer were duplicated and had already drifted.** `article.ts` and the
listing renderer each built their own `<header class="site">`, and only one of them rendered
the tagline. One function each now, called from both. That is the duplication the listing
renderer was extracted to avoid, reappearing one level up.

**Every control in the chrome works without JavaScript.** The search trigger is
`<a href="/search">`, which renders the same results server-side; the island calls
`preventDefault` and opens a `<dialog>` instead. The subscribe trigger is `<a href="#subscribe">`
pointing at the footer form. Neither is a `<button>` with a script behind it, which is what
makes "enhancement" true rather than a word.

**Two bugs the search island would have had, both written as tests:**

- **Out-of-order responses.** A slow answer for `ti` can land after a fast one for
  `timezone` and replace the right results with stale ones. Every request carries a sequence
  number and only the newest may write. The test delays the first response by 300 ms.
- **One request per keystroke.** Debounced to one per 200 ms pause. The test types five
  characters in a burst and asserts exactly one request.

**`lightboxClose` is reused for the overlay's close button** rather than adding a `close`
key. It already says exactly this in six languages, and a second key with the same meaning
is how a locale table starts to drift — which this port has now nearly done twice.

**The island test file hit 469 lines** and the file-size guard caught it. Split by concern:
`islands.test.ts` keeps the article islands, `interactive.test.ts` takes sign-up, comments
and search, and the happy-dom harness moved to `test-dom.ts` so it is registered per file in
one place rather than copied.

Measured on the running server: the home page has one script, an article has two, the
header carries `data-search-open`, and the subscribe trigger is correctly ABSENT because no
mail server is configured — a trigger with nothing behind it is worse than no trigger.

Still to come in M2: the left rail and its table of contents, book mode, and the listing
islands (grid toggle, infinite scroll).

## M2: the listing controls, and one more island deleted (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/assets/js/listing.ts` | `GridToggle` + `InfiniteListing` | Both, self-guarding |
| — | `RevealFallback` | **Deleted.** `animation-timeline: view()` in the sheet |

**core.js 5,186 b against a budget raised from 5,000 to 6,500.** The guard caught it at
5,186 and refused to build, which is the first time the budget has actually stopped
something. The number moved in this diff, deliberately.

**`RevealFallback` is gone, as 04-frontend.md called for.** It existed to ease cards in on
engines without scroll-driven animations. Those animations are what the reading-progress bar
already uses, so the fallback was the last consumer of a shim for a feature this codebase
now depends on. Cards ease in with `animation-timeline: view()`, wrapped in `@supports` and
in `prefers-reduced-motion: no-preference`. An engine without it shows the cards, which is
the correct end state anyway.

**Infinite scroll adds no endpoint.** It fetches the next page's HTML and moves its cards
across. That page has to exist and be crawlable regardless, so this reuses it rather than
adding a second representation of the same list that could drift from the first. On a failed
fetch the island disconnects and leaves the pager alone — the reader still has a working
link, which is the reason the pager was never replaced.

**A cost I am taking rather than hiding.** The frozen tree applied the saved grid/list
choice with a PRE-PAINT INLINE SCRIPT, so a reader who chose grid never saw the list. 2.0
has no inline script anywhere and that property is tested, so the attribute is applied when
`core.js` runs and a grid reader may see one frame of list first. The two alternatives were
worse: an inline script would be the only one on the site, and a cookie would let the server
render it but the page cache is keyed by URL alone (Invariant 1), so a cached page would
carry whichever mode the first visitor happened to have.

**A test bug that made a test pass for the wrong reason.** `delete document.body.dataset[key]`
did not always clear the underlying attribute in happy-dom, so a `data-infinite` set by one
test survived into the next. The harness removes the ATTRIBUTES now. Found because the
"does nothing when infinite scroll is off" case fetched anyway — the one assertion in the
file that could only fail if state leaked.

Measured on the running server: the grid toggle is in the header, the grid and reveal rules
are in the inlined sheet, `data-infinite` is correctly absent (the owner has it off), and
the home page still costs one script.

## M2: the table of contents (2026-07-27)

| File | From | Role |
|---|---|---|
| `src/assets/js/toc.ts` | `Toc.tsx` | The active-section highlight, and nothing else |

**The list itself is server-rendered.** The frozen tree built the whole thing in React, so
a reader without JavaScript had no index of the article at all. Here the `<nav class="toc">`
is markup with real anchors, and the bundle adds only the `aria-current` highlight — the one
part that genuinely needs a script. post.js 6,458 b / 8,000.

**The active row is the LAST heading past the reading line, not the one crossing the
viewport.** That distinction is the whole reason this is not an `IntersectionObserver`: in
the middle of a long section the heading has already scrolled away, nothing intersects, and
the list goes blank. The test places headings at explicit offsets and asserts a row stays
marked while its heading is 600 px above the viewport.

**Not rendered when there is one heading**, because a contents list with a single entry is
furniture rather than navigation. Not rendered on a static page either.

**Two file-size splits this session, both caught by the guard rather than by me.**
`LEDGER.md` passed its 700-line cap (M1 moved to `LEDGER-M1.md`) and `app.test.ts` passed
400 (listings, search, feeds, chrome and the contents list moved to `pages.test.ts`, with
its own database directory — `openDatabases` holds one connection pair per process).

`check:docs` caught the ledger one commit late: it ran in a shell chain whose exit status
came from `tail` rather than from npm, so the violation shipped and was fixed immediately
after. Worth remembering when chaining a check behind a pipe.

Still to come in M2: the left rail (the contents list currently sits above the article
rather than in the gutter) and book mode.
