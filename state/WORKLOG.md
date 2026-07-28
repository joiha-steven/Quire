# Worklog

Newest first. What happened, not what is true now (that is `docs/`) or what is next (that
is `TASKS.md`). Keep entries short; the detail is in the commit.

## 2026-07-28 — the admin was wearing the wrong typeface, and the editor the wrong width

Two reports from the owner, both real, and a third and fourth found while confirming them.

**The admin ignored the chrome font.** The frozen tree's admin sat inside the root layout,
so it inherited `globals.css` (the @font-face block and `body{font-family:var(--font-sans)}`)
and the runtime style block the layout injected from settings. 2.0 serves the admin as its
own document, and that document had no settings in it at all: `admin.css` hard-coded Inter
as a stand-in and `<html lang>` was the literal string `en`. On a site set to JetBrains Mono
the admin stayed Inter, in English, on one frozen palette. The shell now carries the same
five style layers the frozen layout did, in the same order, and the language with them.

**The editor ran edge to edge.** The frozen admin layout wraps `children` in one padded
`max-w-[1480px]` div, with no exception for anything. The port added one for the editor. The
sidebar already clears the way by publishing `--admin-nav-w: 0px`, so the exception bought
nothing and cost the whole page its margins. Removed. This is exactly what the porting rule
is for, and it was broken by someone who had read the rule.

**`data-chrome-font` was never emitted anywhere**, public or admin, so the tracking
correction the two mono faces need had no selector to match and was simply absent from 2.0.
**`data-motion` was never emitted either**, which means the owner's Motion switch in
Settings has done nothing since it was ported. Both are one attribute and a few lines of
CSS, and neither would have been found by reading: they are attributes that were not there.

Also verified in the same pass, by driving the editor rather than reading it: Tiptap mounts
outside Next, typing reaches the document, `##`/`-`/`>` still become heading, list and
quote, the toolbar's 27 buttons command the document, the table button inserts a table, and
the Markdown view round-trips losslessly. Three earlier FAILs in that run were all faults in
the check, not the editor - the last one inserted a table over the paragraph it had just
bolded and then reported that bold had not serialised.

## 2026-07-28 — the sign-in page, rebuilt around the Quire mark

The owner opened `/login` and called it ugly. It was, and the reason was structural rather
than aesthetic: the page loaded the whole public stylesheet, and `main{flex:1}` in that
sheet applies to any main element. The card is a main. It stretched to the full viewport
and a four-field form sat in a 780px-tall empty box. Nobody had looked at this page since
it was written, which is the same failure the screenshot script was added to prevent — it
was only ever pointed at the pages someone thought to check.

The fix is that the login document no longer loads the public sheet at all. It keeps the
`--c-*` palette, so it follows the blog's colours and dark mode, and states everything else
itself in absolute units: the reading typography is tuned for long-form text by a reader
who can enlarge it, and a form inheriting a 22px reading size is how this one came to look
like a terminal. The sheet is appended after the owner's custom CSS on purpose — a blog's
custom CSS may not distort the page you have to get through to fix it.

**The masthead is now the Quire mark, not the blog's logo**, at the owner's request. That
reverses the phishing argument in `06-auth.md`, and the reversal holds: no reader is ever
sent to `/login`, so the page addresses one person, and the door should look the same on
every install. The blog is still named in words, above and below the card. The mark is an
inline SVG of what the word means — a gathering of folded sheets.

Also fixed while in there: the visibility toggle rendered as tofu on Linux (it was an
emoji, now two SVGs that flip with the field), the autofocus ring was a solid red
rectangle, the 32-character enrolment key broke mid-group across lines, and the 6-digit
code field is now set like a code. Checked in a browser at six states, two palettes and two
widths, which is the whole of what "looks trustworthy" comes down to.

## 2026-07-28 — M3 done: the admin exists, and three things that were never wired

**The admin interface was at zero and is now complete.** 68 components and 5 UI primitives
moved out of the frozen tree, a router in place of `next/link` and `next/navigation`, and
one endpoint per page under `/api/admin/view/` standing in for what each server component
used to fetch inline. Every runtime import the components made turned out to be a pure
helper, so the tree moved with its imports rewritten and nothing else touched — which is
the bet [ADR 0006](../docs/decisions/0006-admin-stays-react-spa.md) made, and it held.

**The envelope was missing, and it hid in plain sight.** Every admin component reads
`json.success` and `json.data`; the ported handlers returned the bare payload. It
type-checked, it passed 900 tests, and the media library showed "no images" over 66 of
them. The dashboard counted them correctly at the same time from a different endpoint,
which is what made it look like a data problem. Fixed in one place. The 44 tests that broke
had been asserting the bare shape — they tested the server against itself, and no test in
the suite had ever put a client on the other end.

**Settings regrouped**, at the owner's request: five tangled tabs into seven defined ones,
each printing the question it answers. [ADR 0011](../docs/decisions/0011-settings-regrouped-into-seven.md).

**Three things were wired to nothing:**
- The **MCP transport**, the one genuine rewrite in M3. Stateless Streamable HTTP against
  the SDK. Five wire tests, because "the tools are ported" and "a connector can talk to it"
  are different claims.
- The **manual archive**. Drive is gone by decision; the archive that decision promised in
  exchange did not exist. `VACUUM INTO`, not a file copy — a live SQLite database has a
  write-ahead log and copying the file can capture a torn state.
- **Turnstile**. The server has refused unverified comments since M3 and the widget that
  produces the token was never ported, so on a site with it on, every comment was rejected
  and the form looked broken.

907 tests. Every admin page verified by opening it, signed in, in a real browser.

## 2026-07-28 — The public design, ported for real, and measured against v1

The owner's verdict on the first staging build was "khác quá xa" — nothing like the blog.
It was correct, and the causes were bigger than the missing sidebar.

**No `@font-face` existed anywhere in 2.0.** The settings named Literata and JetBrains Mono,
the layout preloaded their .woff2 files, the routes served them with a 200, and no rule ever
told the browser what they were. Every page rendered in Georgia and a system serif. A
preload with no matching face is a download the browser throws away. `render/font-faces.ts`
now generates them from a table, emitting only the two families a page can use.

**`--font-chrome` never existed.** Four rules asked for it; the real handle is `--font-sans`.
And `body` defaulted to `--font-reading`, so the whole site was set in the article face and
the owner's chrome font was never seen. The rail, the dates and the reading times are mono
on this blog, which is most of its character.

**`--content-width` was never set either**, so every page was 42rem regardless of the
setting. Fixed to `--shell-w`. The gutter is 2rem at every width, which the frozen tree's
markup denies — it says `px-8 sm:px-5`, but no `.sm\:px-5` rule was ever compiled into its
stylesheet. Measured off the rendered page, not read off the class list; the two disagreed
by 24px of column, which is one word per line.

**What was actually missing**, now ported: the listing sidebar (menu, featured, categories
with counts, tags) and its mobile drawer; the year timeline in the right gutter; the logo;
the theme control; the article's meta line, word count, deck, taxonomy, related posts and
sign-up card; the ToC's title and end rows; book typography; and book mode's real reader —
paper grain, drop cap, spine, asterism, and a spread measured to exactly two facing pages.

**`scripts/drive.ts`**: screenshot a page after clicking something, over the DevTools
protocol. `shot.ts` can only photograph what the server sent, which cannot see book mode,
dark mode or any overlay — precisely the surfaces that shipped unlooked-at.

Verified by measuring both sites' rendered pixels, not by reading source: rail 187..416 vs
187..417, column 472..1126 vs 472..1125, book spread 183..1411 vs 183..1417.

**`check:css-literal` had gone stale** and let a fourth backtick through: the sheet had been
split and renamed, and the check kept passing against a constant that no longer existed. Now
covers all three sheets, and its firing was proved before being trusted.

## 2026-07-28 — Staging is live, and `import-v1` finally met a real v1

**<https://next.manhhung.me>** runs Quire 2.0 beside the live v1 on the same box: own user
(`quire2`), own port (3100), own data dir, its own copy of the 92 MB uploads tree. v1 on
:3000 is untouched. One `systemd` unit, `ProtectSystem=strict`, nginx vhost under the
existing `*.manhhung.me` origin cert.

**Bun installed per-user, and `bun install` run ON the server** — which is the whole point:
it fetched `@img/sharp-linux-x64` by itself. Copying `node_modules` from a dev machine
would have shipped the Windows build. 90 MB of dependencies, not the 60 MB estimated,
because sharp carries both glibc and musl variants.

**`import-v1` ran end to end for the first time and found two real bugs.** Same root cause,
two different functions: PostgREST returns a `jsonb` column already PARSED, SQLite holds it
as TEXT, and neither normaliser reconciled that. `verify.ts` compared `[object Object]`
against a JSON string (tier 3 fatal); `checksum.ts` hashed `j:{…}` against `s:54099:{…}`
(tier 2 fatal). Green tier 2 in the first run is what made the tier-3 failure look like a
data problem rather than a comparison one. Both fixed, both now tested.

Third fix: a content reference to a file missing from BOTH v1's media table and its uploads
tree was FATAL. That is a break the source blog already had, which the import can neither
lose nor repair — now a warning. Three of them exist on the real blog.

**Two Cloudflare lessons re-learned.** The staging record was DNS-only at first, so UFW
(CF IPs only) blocked it. And CF cached the home page from before the import, so the site
looked empty while the origin was correct all along — purged via v2's own
`/api/cron?purge=1`, using the CF token the import carried over.

## 2026-07-28 — M3: 55 of 61 API routes

**900 tests, `check:all` green.** Four more commits: `605d00e` (media and files),
`5ea49ed` (newsletter, moderation, integration keys), `96399e7` (cron, health, preview
link, WordPress import), `d1b2638` (the MCP OAuth layer).

**The MCP consent step is the one that mattered.** `/api/mcp/register` is public, so an
attacker can register a client pointing at their own host and phish the owner into
authorizing it — the redirect allowlist passes, because it really is registered for that
client. Only consent plus a session-bound CSRF token stops the code being issued to them.
Both now have a test named after the attack.

Two substitutions forced by next-auth leaving: the OAuth code-signing secret falls back to
a generated one instead of `AUTH_SECRET`, and the consent CSRF token is keyed to the stored
session ID rather than a JWT. The MCP **token** hash format is untouched, which is the part
the risk register cares about.

Three test fixtures were wrong before the code was, and all three are worth knowing: media
is keyed on `path` under `media/`, comments have `author_name`/`content`, and there is no
`scheduled` status — a scheduled post is a PUBLISHED one with a future date.

**Where this stops.** What remains needs things this machine does not have: the Drive
backup needs real OAuth credentials, the admin SPA needs a browser, and the MCP transport
is a rewrite rather than a port because `mcp-handler` is Next-specific.

## 2026-07-28 — M3: the first 21 API routes

**827 tests, `check:all` green.** `c538a4b` (posts, pages, revisions) and `70bd33d`
(taxonomy, series, redirects, settings, trash, activity, cache). Same paths, same shapes,
same status codes — including `slug_taken` and `in_use:<n>`, which clients match on as
strings rather than statuses.

**The gate leaked and it is worth remembering how.** `ownerRouter()` applied
`requireOwner()` as `use('*')` on a sub-app, and `app.route('/', sub)` copies that into the
parent as `/*` — so every public page returned 401. Fifty-one tests failed and none said
why. The gate is now attached per registration; Invariant 4 is intact and there is a test
named after the leak.

**Invariant 1 keeps paying.** `/api/settings` no longer purges-then-warms (a page
re-renders from SQLite in under a millisecond, so warming avoids work that is already
free), and `/api/trash` no longer revalidates per kind and per action.

`app.onError()` replaces sixty-one try/catch blocks and returns a typed 500 without the
exception message, which can carry a path, a SQL fragment or a token.

## 2026-07-28 — M3 begins: auth, and the gate that enforces Invariant 4

**791 tests, `check:all` green.** Two commits: the auth core (`614f4c3`) and the sign-in
flow (`64c6164`). Authentication is the one part of 2.0 that is not a port — `next-auth`
and Google go, password + TOTP is new code — so the protection a pure-motion diff normally
buys is absent and everything is covered by tests written alongside it.

**Two security bugs, both found by RUNNING the flow, neither visible in the code.** The
TOTP code used to *enrol* could be replayed to sign in, because storing the new secret
resets the replay floor. And `/api/auth/enrol/done` issued a session from the pending
ticket alone, so anyone with the right password could POST straight to it and skip
two-factor entirely. The second surfaced because a test about open redirects was passing
*through that path by accident* — green, and proving nothing.

**Invariant 4 is now enforceable, not just stated.** `ownerRouter()` applies the gate at
construction, and `check:routes` fails the build on any write route outside it unless the
path carries a written reason. Proved it fires before trusting it; it then caught a real
forgotten route.

**Three documented deviations from `06-auth.md`.** The lockout counts failures rather than
attempts (the spec's version locks the owner out on their sixth successful sign-in in
fifteen minutes); auth events bypass the activity-log toggle; and `AUTH_SECRET`, which was
also salting the analytics visitor hash with a fallback of the literal `'quire'`, is
replaced by a generated per-purpose secret.

`LEDGER.md` split again: M2 moved to `LEDGER-M2.md` BEFORE the cap was hit this time.

## 2026-07-27 — M2 closes: the left rail

**685 tests, `check:all` green.** The contents list moves into the left gutter above a
breakpoint COMPUTED from the owner's column width, because a media query cannot read a CSS
variable. A test changes `contentWidth` from 700 to 800 and watches the emitted media query
move from 1300px to 1400px.

`RailToggle` is not ported: below the breakpoint the list sits above the article in normal
flow, which needs no drawer, no scrim and no script.

**A verification gap, stated rather than papered over.** Layout is the one thing markup
inspection cannot confirm, so I added a screenshot script pointed at the installed Edge. It
never produced an image — the run hung twice and then failed — and the script and its
dependency were removed rather than left in the tree unexercised. Proven: the generated
media query, its computed breakpoint, the rendered markup. Not proven: how it looks.

**M2 is complete.** 21 of the frozen tree's 23 `'use client'` components are ported, two
were deleted in favour of CSS, and `RailToggle` is made unnecessary by the layout above.
`Turnstile` lands with the comment form's configuration in M3.

## 2026-07-27 — M2: book mode, and a guard for a mistake made three times

**684 tests, `check:all` green.** post.js 7,860 b of 8,000.

The browser paginates, not the island: the stage is `column-width` and turning a page is
one `scrollLeft` assignment. The frozen `BookReader` measured the flow and computed spreads
in JavaScript — 171 lines of React replaced by about 60 of plain code. The overlay reads a
clone, so the page a search engine and a screen reader see is untouched, and there is a test
for that because it is the sort of thing a later refactor would "simplify" away.

**`check:css` now exists.** `public.css.ts` is one template literal, so a backtick anywhere
inside it ends the string. That has happened three times, always in a comment, always around
a CSS property name that reads naturally in backticks — twice the server refused to boot. A
comment saying "no backticks" was already in the file the third time, which is the argument
for a check instead of prose. The check got it wrong first (it reported the module's own doc
comment and failed on a clean file) and was then proved by injecting a backtick and watching
it fail at the right line.

**M2 is complete apart from the left rail.** The contents list sits above the article rather
than in the gutter; that is a layout decision, not a port.

## 2026-07-27 — M2: the table of contents

**680 tests, `check:all` green.** The list is server-rendered markup with real anchors, so
a reader without JavaScript gets a working index of the article — the frozen tree built the
whole thing in React and gave them nothing. The bundle adds only the active-section
highlight.

The active row is the LAST heading past the reading line, not the one crossing the
viewport, and that is the whole reason it is not an `IntersectionObserver`: in the middle of
a long section the heading has already scrolled away, nothing intersects, and the list goes
blank. The test places headings at explicit offsets and asserts a row stays marked while its
heading is 600px above the viewport.

Two file-size splits, both caught by the guards rather than by me: `LEDGER.md` passed its
700-line cap and `app.test.ts` passed 400. `check:docs` caught the first one commit late,
because it ran in a shell chain whose exit status came from `tail` rather than from npm.

## 2026-07-27 — M2: the listing controls, and one more island deleted

Grid toggle and infinite scroll, plus `RevealFallback` deleted in favour of CSS. **673
tests, `check:all` green.**

**The JavaScript budget stopped a build for the first time.** core.js came out at 5,186 b
against 5,000. The number moved to 6,500 in the same diff, which is exactly what the guard
is for: a budget that can only be raised in a diff someone reads.

`RevealFallback` existed to ease cards in on engines without scroll-driven animations —
the same feature the reading-progress bar already depends on, so it was a shim for
something this codebase now requires. Cards ease in with `animation-timeline: view()`,
inside `@supports` and `prefers-reduced-motion: no-preference`.

Infinite scroll adds no endpoint: it fetches the next page's HTML and moves its cards
across. That page has to exist and be crawlable anyway. A failed fetch leaves the pager
alone, because the reader still has a working link.

**A cost I am taking rather than hiding.** The frozen tree applied the saved grid/list
choice with a pre-paint inline script. 2.0 has no inline script anywhere and that property
is tested, so a grid reader may see one frame of list first. A cookie would fix it but the
page cache is keyed by URL alone, so a cached page would carry the first visitor's mode.

A test bug worth recording: `delete document.body.dataset[key]` did not always clear the
attribute in happy-dom, so state leaked between tests. Found because the one case that
could only fail on leaked state did.

## 2026-07-27 — M2: the site chrome, and search without a page load

One header and one footer, shared by both renderers, plus the search overlay. **667 tests,
`check:all` green.** core.js 3,849 b, post.js 5,999 b.

The header and footer had been duplicated across the article and listing renderers and had
already drifted: only one of them rendered the tagline. That is exactly the duplication the
listing renderer was extracted to avoid, reappearing one level up.

**Every control in the chrome works without JavaScript.** The search trigger is a link to
`/search`, which renders the same results server-side; the island intercepts the click and
opens a dialog. The subscribe trigger points at the footer form. Neither is a button with a
script behind it, which is what makes "enhancement" true rather than a word.

Two bugs the search island would have had are now tests: a slow response for "ti" landing
after a fast one for "timezone" and replacing the right results (every request carries a
sequence number), and one request per keystroke (debounced, with a five-character burst
asserting exactly one request).

The island test file hit 469 lines and the file-size guard caught it; split by concern,
with the happy-dom harness extracted so it is registered per file in one place.

## 2026-07-27 — M2: the two things a reader can write to

Comments and newsletter sign-up, both ends: the endpoints and the islands. **656 tests,
`check:all` green.** post.js is 6,700 b against a budget raised from 4,000 to 8,000 — the
budget moving is the point, it moved in a diff someone reads.

**Google sign-in is gone, so the trusted-commenter path is gone with it** (ADR 0007). The
frozen tree skipped Turnstile and took name and email from the session for a signed-in
commenter. Only the manual path survives. Recorded in `07-parity.md` §7a as removed rather
than pending, because it is not coming back.

**One deliberate deviation, stated as one.** The frozen tree built its sign-up form in
JavaScript, so a reader without it saw no form. 2.0 renders the form server-side, which
means that reader can now submit it — and answering them with a page of JSON would be a
defect this port created rather than one it carried. `/api/subscribe` takes a form post as
well as JSON and replies in kind, with the same status either way: 400 stays 400, because
the status describes the request and not the presentation.

The XSS boundary in the comment island is one line either way: the body goes through
`innerHTML` because the server sanitised it, the author name through `textContent` because
nobody did. There is a test that puts an `onerror` payload in a name.

Three near-misses of my own, all caught before they shipped: 15 locale keys that mostly
already existed (duplicate keys in one object literal are a compile error, which is the only
reason this was not a second drifting set of strings), two new keys named outside the `nl*`
family beside them, and a test seeding rows through `db().run(sql, a, b)` — the same
binding trap `store/query.ts` documents.

## 2026-07-27 — M2: the machine surfaces, and the files nobody was serving

Markdown for agents, the PWA manifest, `/api/search`, the tokened draft preview, and the
static files. **627 tests, `check:all` green.**

**`public/` was never served, and that mattered more than it sounds.** Every page preloads
`/fonts/inter-latin.woff2` and nothing answered it, so the site's reading font never loaded
and the whole typography system was decorative. Found by requesting the URL after the
manifest landed, not by a test. The 21 fonts and both icons are now embedded in the binary
and listed by name, because there is no glob import a compiler can follow and a font
missing from that list works in development and 404s in production.

**The sharp risk escalated to "the server will not start", and is now back to "one route
fails".** Adding the OG card put sharp on the boot path, and the compiled binary died at
startup. The second cause was not obvious: `content/settings.ts` imports `renderLogo`, and
settings is on every request. Both imports are deferred to the point of use now.

Measured on the compiled binary in a directory containing nothing but the exe: the blog,
every font, both icons, the manifest and robots all serve; `/og` returns a logged 500. That
is the right failure shape, and the packaging decision stays M4's.

Content negotiation moved out of `next.config.ts` into the router, four lines next to the
route it affects. Request logging became middleware rather than a call every handler had to
remember at the end of each early return.

## 2026-07-27 — M2: OG cards, and the route that serves every image

`GET /og` renders the 1200x630 card with satori and sharp, and the shell finally emits
Open Graph and Twitter tags at all. **610 tests, `check:all` green.** Cards were rendered
and looked at: a post card, a Vietnamese title (one crossbar on đ, which is what the three
distinct font subsets are for), and a card over a real cover image.

**One bug in this slice was invisible to every structural test.** satori ignores
`inset: 0`, so the dark overlay collapsed to zero height and the card came back as white
text on bright orange: a valid 1200x630 PNG that nobody could read. Status 200, correct
dimensions, correct content type. Opening the picture is what found it.

**`GET /uploads/*` did not exist**, so every image in a rendered post, every featured image
and every OG background was a 404. Found while wiring the card's background rather than by
a test. Ported with its byte-range support intact, because video seeking needs 206 and iOS
Safari will not play a video without it.

Two of my own tests were measuring nothing and said so confidently: `sharp.stats()` reads
the input image and ignores the pipeline, so every crop of the card returned the same
number, and the fourth channel is alpha at a flat 255. A third compared two strips of one
card, which measures the background gradient rather than the type. And a traversal test
passed without the handler ever running, because the URL was normalised before routing.

## 2026-07-27 — M2: the analytics beacon

`POST /api/track` and the browser half of it. **592 tests, `check:all` green.** Driven
against the running server: a view lands with its referrer host, device, browser and OS; a
depth sample lands at 83% and 45 s of dwell; a Googlebot beacon is dropped; and the stored
row contains neither the IP nor the user-agent, only a hash.

**core.js is 1,162 b, post.js is 2,966 b, and both numbers now fail the build if
exceeded.** A listing pays for the first, an article for both. Adding a feature either fits
or moves a number in a diff someone reads.

`whenActivated` moved into its own module, because the bundler shakes per module and it was
riding into `post.js` where nothing calls it. Found by grepping the built bundle, not by
reading the source; it took core.js down 440 b as well.

**One behaviour is deliberately not ported yet and is written down rather than left to be
noticed.** The frozen handler skips the owner's own visits via `requireOwner()`, and 2.0
has no session to ask until M3. Recorded in `07-parity.md` §8 and at the top of `track.ts`.

## 2026-07-27 — M2: the first islands, hand-written

Back-to-top, code copy and the image lightbox, ported from React to vanilla. **583 tests,
`check:all` green.** The whole article page now costs **2,966 bytes of minified
JavaScript**, in one deferred request, cached `immutable` under a content-hashed URL.
Listings, taxonomy, series, search and the feeds still ship zero.

**Two of the four were deleted rather than ported**, as `04-frontend.md` had already
decided. The reading-progress bar is now server-rendered markup driven by
`animation-timeline: scroll()`, so it costs no script and works with JavaScript off. The
lightbox is a `<dialog>`, so Escape, focus trapping and the inert background come from the
browser. I wrote both as JavaScript first, in a straight port, and caught it only on
re-reading the spec: applying the porting rule past the plan is not discipline.

Every string an island shows is translated server-side and passed as a `data-` attribute,
so the bundle carries no locale table and cannot disagree with the page it is on.

Two things are structurally better than the frozen tree, not just moved. **The DOM
boundary is type-checked**: `src/assets/js/` has its own tsconfig with DOM types and the
root project excludes it, so a server module that reaches for `document` fails to compile.
And **the islands have tests at all** — 14 of them, against happy-dom, covering what was
previously only inspectable by eye: the copy button is idempotent, the lightbox wraps at
both ends, tears down however it was closed, and reopens cleanly.

The bundle is built ahead of time rather than on first request, because `bun build
--compile` leaves no source tree beside the binary: a runtime build would have worked in
development and failed in production.

## 2026-07-27 — M2: every public route is live

Home and pagination, category, tag, series, search, RSS, sitemap, robots and llms.txt.
**567 tests, `check:all` green.** Exercised against the running server: every route
answers, and **every HTML route contains zero `<script`**.

```
/                        200   9,407 b
/category/engineering    200   9,158 b
/search?q=timezone       200   8,936 b
/feed.xml                200   1,608 b
/sitemap.xml  /robots.txt  /llms.txt   200
/series/x  /nope         404
```

**The test found an SEO bug.** `paginate` clamps an out-of-range page, so checking "did
this page come back empty?" never fired: `/page/9` of a two-page blog served page two,
under a ninth URL, and so would every number a crawler tried. Duplicate content at
unbounded URLs. It compares against `totalPages` now.

Three decisions worth naming. Search is **not** cached, because its key is the query
string and a cache any anonymous visitor can fill is a memory leak with a nicer name. A
feed the owner turned off **404s** instead of serving an empty document, because an empty
feed looks like a broken site to an aggregator. And pagination is prev/next rather than
numbered: deep page numbers are navigation nobody uses and every one is a URL a crawler
walks.

One renderer serves home, taxonomy, series and search. The frozen tree had a component per
surface, and the differences turned out to be the heading and the empty-state line, which
is exactly the duplication that drifts.

## 2026-07-27 — M2: Quire 2.0 serves a page

`env`, `index.ts`, the Hono router, the HTML shell and the hand-written public sheet.
**555 tests, `check:all` green.** The server boots, reads a post out of SQLite and returns
a complete article page.

Measured on the running server rather than reasoned about:

```
cold request   256 ms   (Shiki's one-time WASM init)
warm requests  2-4 ms   (page cache hit)
page weight    9,042 bytes, ZERO script tags, ZERO stylesheet requests
```

**Opening the page in a browser found a bug that reading the markup would not.**
`applyFootnotes` already emits `<hr class="fn-rule">`, and the new sheet also put a
`border-top` on `.footnotes`, drawing two rules above the notes. The frozen tree styles
`.fn-rule` and leaves `.footnotes` borderless; the sheet now matches. Then the comment
explaining the fix used backticks inside a template literal and stopped the server
booting, which is the right way to find out.

14 router tests over real HTTP. The two that matter are not about markup: an article page
contains no `<script`, and a draft, a future-dated post and a trashed post all 404 rather
than leaking.

Still to come in M2: listings, taxonomy, series, search, feeds, OG images, and the 23
islands as vanilla JavaScript.

## 2026-07-27 — M2 started: the renderer, and the byte-identical gate HELD

`highlight` and `PostContent` ported. **541 tests, `check:all` green.** The article-body
gate is met: **46/46 golden fixtures byte-identical to Quire 1.x**, including the ones that
run Shiki.

`PostContent` was already pure string manipulation with a React wrapper at the end, so the
only change is the return value: a server component ending in `dangerouslySetInnerHTML`
becomes a function returning the HTML string. Its 22 tests moved with only the two-line
`render()` helper adapted.

The reference HTML was produced by **running the frozen renderer**, not written by hand:
`golden/capture-corpus.ts` imports the frozen component by relative path and runs it under
Bun, writing nothing to `../src`. Hand-written expectations would only test that the port
was transcribed consistently with itself.

45 fixtures cover the 03-golden.md list, including the ones that are also security
assertions: raw HTML escaped (Invariant 5), and `javascript:`/`data:`/`vbscript:` hrefs
dropped, one of them tab-obfuscated.

**A mistake worth recording:** `bun add` was run with the working directory at the repo
root, so it edited the FROZEN tree's `package.json`, bumping `marked` and `shiki`. Reverted
with `git checkout`. It surfaced something that matters, though: the frozen tree resolves
`marked` 18.0.5 and `shiki` 4.2.0, older than what `bun add` picks, and v2 now pins those
EXACT versions with no caret. A byte comparison against a floating dependency fails on a
patch release and teaches everyone to ignore it.

## 2026-07-27 — M1 complete: the MCP store and `import-v1`

`mcp/tokens`, `mcp/clients` and `mcp/used-codes` moved, then `import-v1` built.
**473 tests, `check:all` green.** M1 is done: every `db()` call site is on `bun:sqlite`,
all six plpgsql functions are reimplemented, and the importer exists with its four tiers.

Both frozen MCP tests mocked the query builder, and they guard real attacks: open redirect
leading to owner-account takeover, and authorization-code replay. A hand-written fake
modelling a PRIMARY KEY was the wrong thing to trust there, so both now run against real
rows, plus two fail-closed cases the mocks could not express. The token hash format is
unchanged, which is what keeps the connectors the owner already holds working.

The importer is deliberately split: transforms, checksum, verification and the writers are
pure and live in `src/import/` with 51 tests; only the PostgREST reader and the CLI are in
`scripts/`. A verifier wired straight into two live databases can only be tested by having
two live databases, which in practice means it is tested once, by hand, on the day it is
written. Every tier here is tested against the corruption it claims to catch.

Two things it does that matter more than they look. The checksum canonicalises timestamps
to epoch milliseconds **on both sides**, because Postgres sends
`2026-07-27T10:00:00+00:00` and SQLite holds an integer; without that every dated table
reports a permanent false mismatch, and a verifier that cries wolf gets ignored on the one
run that mattered. And `ts()`/`bool()` throw rather than defaulting: a date silently
becoming 1970, or a flag silently becoming false, is a post that never publishes and
nobody can explain.

**Not yet done, and it is the honest gap: the two sides have never met.** Every part is
tested in isolation; an end-to-end run needs the dev Postgres stack up. Tracked in
`TASKS.md`, and production is not where it gets tried first.

## 2026-07-27 — M1: analytics, and the six SQL functions are gone

All six plpgsql functions reimplemented in TypeScript. **401 tests pass, 0 fail.**

The hard part was never the aggregation, it was `date_trunc(bucket, created_at at time
zone tz)`. SQLite has no timezone database, and a fixed offset is wrong in general because
a DST day is 23 or 25 hours long, so stepping by 86,400,000 ms slides every later bucket by
an hour. Boundaries are now computed in TypeScript with `Intl.DateTimeFormat` and handed to
SQLite as explicit `[lo, hi)` pairs, which leaves the counting where the indexes are.

**That code had a real bug and its own test found it.** The first formatter used
`hour12: false`, under which a local midnight renders as hour "24" of the PREVIOUS day.
That is exactly the instant day and week buckets start on, so the computed offset was a full
day out and the fall-back day came back 23 hours long instead of 25. `hourCycle: 'h23'`
fixes it; 16 tests now cover both transitions, Monday week starts, and the label formats.

Two more things worth naming. Channels are folded in TypeScript over distinct
(host, visitor) pairs, because the obvious shape (per-host counts summed by channel)
double-counts anyone who arrived from two hosts in the same channel. And
`analytics_facet`'s exception turned out unnecessary: three complete SQL literals picked
from a fixed map do the job, so the no-assembled-SQL rule holds everywhere with no
exception at all.

Invariant 7 exists now: analytics writes buffer and flush every 2 seconds or 200 rows, in
one transaction, never from a handler.

## 2026-07-27 — M1: newsletter and the small modules. Only analytics left

`nodemailer` joins `sharp` as the second runtime dependency, then `activity`, `series`,
`scheduled`, `media-refs`, `newsletter-log`, `subscribers`, `mail`, `broadcast` and
`comment-notify`. **361 tests pass, 0 fail**, typecheck and file-size clean.

**The port found a schema bug, which is the point of doing it this way.**
`integration_keys.smtp_secure` had been translated as `integer not null default 1`, but the
Postgres column was nullable and `mail.ts` reads NULL as "not chosen, infer from the port".
With NOT NULL DEFAULT 1, any install that had ever saved an unrelated key on that shared
row (one Turnstile site key is enough) would resolve `secure = true`, so a port-587
STARTTLS server would quietly stop accepting mail with nothing in the UI to explain it.
Column is nullable again, with the regression case named after the bug.

`purgeAndWarm` loses its second half. The frozen tree re-warmed the origin after a purge
because Next's ISR cache was on disk and a cold render cost a visitor real time; there is
nothing to warm when the cache is an in-process Map and a miss is a sub-millisecond SQLite
read. `newlyLive` itself is untouched and its 6 tests moved verbatim, so the definition of
"went live" did not move with the plumbing.

Two more pure test files moved unchanged (`scheduled`, `series-order`). The frozen
`newsletter-log.test.ts` did not: it mocked the query builder, and the replacement runs the
same folds against real rows.

Left in M1: `analytics` (with the six SQL functions), the `og` database parts, `mcp/*`,
and the importer.

## 2026-07-27 — M1: the content core on SQLite. Posts, terms, comments, media, settings

`sharp` added as 2.0's first runtime dependency, then `image` (moved verbatim, 6 tests),
`files`, `media` + `finalize`, `settings`, `comments` and `posts` + `post-terms`.
**`bun run check:all` is green: typecheck clean, 298 tests pass, 0 fail.** Every `@/lib/*`
import in the moved tree now resolves inside 2.0.

The largest shape change is taxonomy: `categories`/`tags` were two Postgres `text[]`
columns and are now the `post_terms` junction. That deletes the one read-modify-write the
frozen tree documented as an accepted last-write-wins risk; a site-wide rename is two
statements, and the collision-merge falls out of the primary key instead of an array
de-dupe. 13 tests cover it, including the merge.

Search needed a guard the old stack gave for free: PostgREST's `websearch` parsed user
text, while a raw FTS5 `match ?` throws a syntax error on `C++`, a stray quote or a bare
`OR` — which would have shown up as a search that silently returns nothing. Every word is
now a quoted phrase. Ordering deliberately stays date-desc: BM25 is an allowed parity
exception that was NOT taken during the port, so a ranking change cannot be mistaken for a
port bug.

`soft-delete.test.ts`, the mock that hand-wrote a filter engine to prove Invariant 6, is
replaced by real rows in a real table. The comment tests keep `buildCommentTree` verbatim
and rebuild only the `addComment` guards, which now prove depth comes from the STORED
parent rather than the caller.

**Measured while here, and it contradicts a headline claim:** `bun build --compile` bundles
sharp's JavaScript but not its native module, so the compiled binary throws
"Could not load the sharp module" on the first image call, from any working directory.
"One executable" is really "one executable plus a native module directory". The risk
register predicted it; it now says so with evidence, and M4 has to pick a shape.

## 2026-07-27 — M1: the first six `db()` modules on SQLite, and the query-builder mocks deleted

`store/query.ts` (`one`/`all`/`run`/`tx`, deliberately not a query builder), `server/cache.ts`
(`clearCache()`, Invariant 1 in its 2.0 form), then `integration-keys`, `slugs`, `redirects`,
`revisions` and `pages` rewritten off `@supabase/postgrest-js` onto `bun:sqlite`. Signatures
and semantics unchanged; the functions stay `async` although the driver is synchronous,
because their callers already await them.

**39 new tests, all against a real SQLite database.** The frozen tree had to mock the
PostgREST builder, and `soft-delete.test.ts` went as far as hand-writing a filter engine,
i.e. a second unverified copy of the database's behaviour. That is now deleted: a read path
that drops `liveOnly` fails because SQLite really returns the trashed row. Suite: 223 pass,
0 fail.

Two deviations from pure motion, both forced by the storage change and both recorded in the
ledger: revisions order by `saved_at desc, id desc` (Postgres had microsecond timestamps,
these are milliseconds, and an untied ORDER BY would let the trim delete the wrong
snapshot), and `saveIntegrationKeys` merges in TypeScript rather than assembling a SET
clause from the payload.

`settings` did not move: it needs `files.renderLogo`, which needs `sharp`, which would be
2.0's first runtime dependency and deserves its own decision rather than being smuggled in
under a data-layer commit. So `email-brand.test.ts` is still blocked.

Typecheck errors: 11 to 6, all three remaining ones (`posts`, `settings`, `media`).

## 2026-07-27 — M1: 33 modules and 184 tests moved, suite green

The slice ADR 0005 was betting on. 2,412 lines of pure logic plus 4,983 lines of locale
data moved into `v2/`, and **184 tests pass under `bun test` from a suite written for
vitest, without a single assertion touched.**

Total edit cost: 46 import specifiers across 43 files. 28 were `@/lib/<name>` (2.0 has
modules, not a `lib/` directory) and 18 repointed `from 'vitest'` to a local shim that maps
vitest's call shapes onto `bun:test`. No module body and no test body changed.

Two things went wrong and are worth keeping. The first `tsconfig.json` enabled
`noUncheckedIndexedAccess`, which the frozen tree does not have; it produced ~20 errors in
code that compiles cleanly at source, converting a pure-motion diff into a rewrite.
Reverted, and tightening is now a task for after the port. The second: `prerender.ts` was
copied into `server/` when it is browser code, which the DOM globals exposed immediately.
Pulled back out and recorded, since it becomes part of `assets/js/core.js` in M2.

`scripts/port/LEDGER.md` records every file moved, every file left behind with its reason,
and the one test waiting on a dependency, so nothing can be dropped silently.

Remaining typecheck errors: 11, every one tracing to the 6 modules not yet ported.

## 2026-07-27 — M1 started: Bun installed, SQLite schema live and tested

Bun 1.3.14 installed via winget. Three assumptions checked against the real runtime before
writing code: FTS5 `remove_diacritics 2` folds Vietnamese (`"lap trinh"` matches
`Lập trình`), `Bun.password` is argon2id, and `generate_series` is **not** compiled in.
The last one costs nothing because the analytics design already computes bucket boundaries
in TypeScript, but it is now recorded in `v2/docs/01-schema.md` rather than waiting to be
discovered halfway through.

`v2/` scaffolded. The Postgres schema (612 lines) translated to two SQLite files and
applied at boot inside a transaction. Eight tests green, covering the parts SQLite is picky
about: the FTS index follows insert, update and delete; `AUTOINCREMENT` stops a purged
comment id being reissued under live replies; `post_terms` cascades.

One real bug found by the test that calls `openDatabases` twice: the second call leaked the
first pair of file handles. Windows surfaced it immediately as EBUSY; on Linux it would
have leaked descriptors silently.

## 2026-07-27 — Documentation layout rebuilt to the four-homes standard

Four homes adopted ([ADR 0010](../docs/decisions/0010-four-homes-doc-layout.md)). `ROADMAP`
and `audit/` moved into `state/`, the two dated files in `docs/` split by kind (the admin
design contract stayed and lost its date, the worklog became a report), ten ADRs written
covering the last month including the one that reversed a day later, and
`scripts/checks/docs.mjs` added to hold the layout. `CLAUDE.md` cut from 275 lines to a
router. Splitting `features.md` into per-module specs deferred with a reason.

## 2026-07-27 — M0.5: parity checklist

`v2/docs/07-parity.md`, 214 items, drawn from `/admin/help`, `docs/features.md` and the
invariants. Marks the behaviours that are easy to lose and have no test, and states its own
gaps so a fully ticked file is not mistaken for proof.

## 2026-07-27 — M0 shipped to production (`58cf8f9`)

`opsz` pinned at 18 ([ADR 0009](../docs/decisions/0009-pin-optical-size-axis.md)): preload
set 97,588 to 46,212 B. Speculation Rules added, and with them `lib/prerender.ts`, because a
prerendered page runs its JavaScript at speculation time and `Track` would have recorded a
pageview on every hover. The CSS split turned out to be already correct, verified in the
build rather than assumed.

Corrected the same day: an intermediate claim that the plan's font premise was false came
from a local build reading a dev database whose settings differ from production.

## 2026-07-27 — Quire 2.0 retargeted from Go to Bun

[ADR 0005](../docs/decisions/0005-rewrite-in-bun-hono-sqlite.md) supersedes
[0004](../docs/decisions/0004-rewrite-in-go-on-sqlite.md) after one day. Seven specs written
under `v2/docs/`; `go/` marked superseded with a record of what was salvaged. Admin stays
React ([0006](../docs/decisions/0006-admin-stays-react-spa.md)), Google login goes
([0007](../docs/decisions/0007-self-hosted-password-totp-auth.md)), Tailwind leaves the
public site ([0008](../docs/decisions/0008-hand-written-css-no-tailwind-public.md)).

## 2026-07-26 — v1.5.0 released, then frozen

Newsletter as a first-class subsystem, a real dev stack, a security pass, and the
`SUPABASE_*` to `POSTGREST_*` env rename. The tree was frozen the same day
([ADR 0003](../docs/decisions/0003-freeze-v1-rewrite-as-v2.md)) and the SaaS direction
dropped ([ADR 0002](../docs/decisions/0002-no-saas-single-instance.md)).

Earlier history: `CHANGELOG.md` (releases) and `state/audits/` (review passes).
