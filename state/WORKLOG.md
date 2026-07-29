# Worklog

Newest first. What happened, not what is true now (that is `docs/`) or what is next (that
is `TASKS.md`). Keep entries short; the detail is in the commit.

Older entries roll into [`worklog/`](worklog/2026-07-quire-2-rewrite.md) when this file
passes its size cap. Rolling is a move, never a rewrite.

## 2026-07-29 (later) — the type settings were half-connected, and the sheet was re-sent every page

Second pass, full report in
[`audits/2026-07-29-typography-security-perf.md`](audits/2026-07-29-typography-security-perf.md).
Measured, not read: a specimen post carrying every text role, driven in headless Chromium
against a throwaway instance.

**Eight surfaces took a type role's SIZE and inherited the rest**, so the owner's
line-height and letter-spacing did nothing on the figcaption, the footnote block, both code
forms, the tagline, the footer, the ToC sub-rows and the copy button. Every one of them
looks wired — the rule names `var(--fs-<role>)` — which is why it was never spotted by
reading. `check:type` now demands all three, canaried. Adding tracking to chrome rules broke
the mono-chrome correction first (a rule that states the property stops inheriting it), so
`MONO_TRACKING` lists them.

**A heading did not belong to its own section.** Top margins scale with the heading, the
space below with the body, so the two converged as the level dropped and inverted at h5:
22px above, 25px below. Now 27/11 there and 44/14 at h2.

**`--font-mono` was referenced and never defined**, so inline code came out in Literata and
a fenced block came out in `ui-monospace`. Owner chose a real mono: JetBrains Mono,
self-hosted, already shipping for the chrome option. A post with no code downloads none of
it — `unicode-range` means a declaration is not a download.

**Source Sans 3 ran at 79 characters per line** where the others sit at 70-72, and its note
had reasoned from a short x-height to "loosen the line", which is backwards. The leading is
fixed (3.52 → 3.34 x the x-height, against the serifs' 3.31). The MEASURE is not: sizing up
far enough measured well and failed two pinned tests that tie `small` to body, and those
tests are right — `small` also sets the chrome. Recorded instead: the measure belongs to
`contentWidth`, which a preset does not own.

Reset also restored `DEFAULT_TYPOGRAPHY` regardless of the chosen font, and five of the
eight font tiles in the picker rendered in a fallback face.

**42.6 KB of the 48.7 KB of CSS per page was byte-identical everywhere.** Split at that
seam: a hashed immutable sheet plus the settings inline after it. HTML per post 65.0 → 25.4
KB, LCP 132 ms at the origin, CLS 0.

**Security.** `/api/cron` had no rate limit while clearing caches, calling Cloudflare's
purge API, running sharp and taking backups — open by default, one thread. `/search` ran
uncached FTS5 uncapped while its API half was capped. The app sent no `nosniff`,
`X-Frame-Options` or referrer policy (nginx did, which made them one deployment's property).
`/og` took its same-origin check from the client's `Host` header.

**`check:css-literal` was not scanning `prose.css.ts`**, whose own header says it is. A
backtick got through during this work and the server refused to boot while the check said
ok — the second time that list has gone stale.

## 2026-07-29 — the Go plan is gone, and an audit found dark mode broken in production

Removed `attic/`. [ADR 0004](../docs/decisions/0004-rewrite-in-go-on-sqlite.md) and
[0005](../docs/decisions/0005-rewrite-in-bun-hono-sqlite.md) already carry the decision,
the reversal and the salvage record, which is the part that stops the argument being
re-run; the specs described a program nobody will ever build. Amendment appended to 0012.

Then a first pass over 2.0 — full report in
[`audits/2026-07-29-post-cutover.md`](audits/2026-07-29-post-cutover.md). Three fixes,
all of them measured with headless Chromium rather than read out of source.

**The bundles shared a global scope.** Built as ESM, injected as plain `<script src defer>`
— a classic script, so every top-level declaration is global. `core.js` and `post.js` both
declared a helper the minifier named `h`, post.js loaded second, and clicking Dark called
the toggle button as if it were a function. The theme was written to localStorage first, so
it looked fine after a reload, which is why it survived cutover. `format: 'iife'`, 11 bytes
a bundle. Nothing could have caught it: every test in `src/assets/js` imports the
TypeScript, and the shipped artifact had no test. It has one now.

**Form controls did not inherit the page font** — the second Tailwind-preflight reset to go
missing, one day after the first. "Sao chép" and "Lên đầu trang" were painting in the UA
font at 12px/normal on a site whose rule is one typeface and no hardcoded sizes.

**Admin tables were clipped on a phone.** The card is `overflow-hidden` for its corners and
that was the only box, so the analytics table's last column sat past the viewport edge with
nothing to scroll. Fixed in the shared `TableFrame` and the four components that hand-roll
the same wrapper.

The admin was driven on a throwaway instance built from a `VACUUM INTO` snapshot, so no
admin request touched production. 925 tests.

## 2026-07-28 — the repository now describes the program that is actually running

Cutover inverted every default in this repository and left them inverted. `src/` meant the
implementation nobody was allowed to change. `package.json` was the one that could not be
installed on the box serving the site. The deploy path started with `cd v2`. `CLAUDE.md`
opened by describing a frozen tree, and it loads on every turn.

2.0 is at the root; the Next tree moved to `v1/` whole, with its own `src/`, `public/`,
`scripts/`, `deploy/`, `docker/`, config, README and CLAUDE. The abandoned Go plan went to
`attic/`, kept separate on purpose: `v1/` is frozen but still running, `attic/` never ran.
Everything moved with `git mv`, so the history survives. [ADR 0012](../docs/decisions/0012-flatten-repo-after-cutover.md).

**The docs check had been left behind in the frozen tree and had not run since the rewrite
began.** Porting it to `scripts/checks/docs.ts` and wiring it into `check:all` was the only
reason this move was safe: it found **56 broken links** the move created, and one thing the
move did not — `state/WORKLOG.md` had drifted to 879 lines, past a cap nobody was
enforcing. Rolled the rewrite's build log into `state/worklog/` and exempted append-only
logs from the cap, since they are read newest-first and a split buys nothing.

`bun test` then started running v1's ~100 vitest files and failing on `vi.hoisted`. Passing
`src` as a filter does not fix it: Bun matches filters as substrings, so `src` also matches
`v1/src`. `bunfig.toml` with `[test] root = "src"` does.

Documents whose rules survived the port stayed in `docs/` even though they cite Next file
paths, because filing live rules under an archive is the worse of the two errors. Which
files, and the fact that their citations are stale, is now stated once in `docs/README.md`
rather than implied. `docs/invariants.md` was NOT treated that way: 2.0's seven invariants
are genuinely different rules, so v1's moved to `v1/docs/` and a new one was written
against the code that enforces them.

Two things this surfaced and did not fix. CI still runs `npm ci` at the root and is red
until a human edits it — the credential in use lacks the `workflow` scope. And
`scripts/ops/` was committed last night carrying a live domain, box paths and a bucket
name, into a PUBLIC repository whose own rule forbids exactly that. Both are at the top of
`TASKS.md`.

918 tests, `check:all` green.

## 2026-07-28 — M4: manhhung.me is Quire 2.0

Two things had to land first, and both were about losing something rather than about the
site looking right.

**There was no backup.** Google Drive was dropped on the argument that replication would
replace it, and until this afternoon the only copy of everything the owner had written was
one directory on one machine. `scripts/ops/quire2-backup.sh` now sends both databases to R2
hourly with `VACUUM INTO` — never a file copy, because a live SQLite database has a
write-ahead log — and syncs the uploads with a 7-day `--backup-dir`. Verified by RESTORING
it: 2 MB archive, `integrity_check` ok, 74 posts and 4 pages present. It is a separate
script from `jk-backup.sh` on purpose: that one backs up the money site, and adding a sixth
engine to a proven, monitored backup to serve a blog would have put those at risk for no
gain. It reuses its R2 remote, its retention habit and its alert hook.

**Nothing said what a shared cache could do with a page**, so the CDN decided. That cost an
hour of chasing a staging bug that had already been fixed, and on the live domain the same
thing is a published post nobody can see. Public pages now say `s-maxage=60` with
`stale-while-revalidate`; the admin, the sign-in page and anything that is not a 200 say
`private, no-store`.

Then the switch itself:

- `old.manhhung.me` serves the frozen tree on :3000, `noindex`, keeping its
  `'unsafe-inline'` CSP because Next needs it.
- `manhhung.me` serves 2.0 on :3100 with a STRICTER CSP — no `'unsafe-inline'` for scripts,
  which 2.0 can finally afford because it has no inline script anywhere and that property
  is tested.
- `SITE_URL` moved with it. Canonical, og:url, robots, sitemap and the feed all say
  manhhung.me.

**`import-v1` was deliberately NOT re-run.** The counts matched on both sides (74 posts, 4
pages, 2 comments, 68 media) and so did the newest rows to the millisecond — nothing had
been written to the frozen tree since the import that morning, so a reimport would have
been a no-op carrying real risk.

Every session was revoked at the cutover. The cookie is `__Host-` prefixed and therefore
host-scoped, so a session from next.manhhung.me would not have carried to manhhung.me
anyway; revoking also retires the token that was minted for driving the browser during the
week's debugging.

Left for the owner: purge the Cloudflare cache. The edge still holds the frozen tree's HTML
under `s-maxage=3600, stale-while-revalidate=31532400` — a year of permitted staleness —
and no Cloudflare credentials exist on the box.

## 2026-07-28 — the header controls, the feed, and a margin the browser was supplying

The owner went through the public site control by control. Everything reported was real,
and each one had the same shape: something that had never been opened after it was written.

**Search and the comment thread were both broken by the API envelope.** When the envelope
was introduced for the admin, its 68 components were checked and the six public islands
were not. Search read an object where an array belonged and reported nothing found; the
comment thread destructured `comments` off the wrapper, got undefined and threw, so no
thread rendered at all. One `payload()` helper, three call sites. Their fetch stubs were
updated in the same commit - the stubs had been agreeing with the islands rather than with
the server, which is the second time that exact pattern has hidden a real break.

**The theme menu had no CSS whatsoever.** The island builds `.theme-wrap` and `.theme-menu`
and nothing in either sheet matched them, so the four rows rendered as blocks that pushed
the header apart. Ported from the frozen tree's Tailwind, tick included.

**The header's mail button opened nothing.** Its `href` is an anchor that only exists at
the foot of an article, so on every listing it scrolled nowhere. It now opens a modal
carrying its own copy of the form. Finding that also turned up the in-page card never being
enhanced at all: the handler looked for the status line inside the form rather than beside
it, returned early, and every sign-up did a full page POST. Its test asserted the same
wrong markup.

**Book mode drifted one column gap per page turn.** It turned with a relative
`scrollBy(viewport.clientWidth)`, but the viewport is `2*col + gap` and the next spread
starts at `2*(col + gap)`, so by the third page the reader was looking at two half columns.
The spread INDEX is the state now and the step is measured. The crossfade the frozen tree
had between spreads is back, at 130ms rather than 200.

**The three columns were not level, and the cause was a margin nobody wrote.** The frozen
tree gets a block-margin reset from Tailwind's preflight and its layout is built on top of
it: the listing card sets its own `.mt-2` / `.mt-3` and expects nothing from the browser.
2.0 has no preflight, so the card's first paragraph carried the browser's default 1em, it
collapsed out through the card, and the whole feed sat 14px below the rail beside it.
Measured after the reset: rail, feed and timeline all start at 165.

**The feed had no scroll reveal and no chunking.** The `.reveal` class has been on every
card since M2 and no rule ever matched it, so nothing eased in - which is what "the fade at
the bottom is gone" meant. And all 68 posts rendered at once. Both are now the frozen
tree's behaviour: the CSS reveal (guarded on view() timelines, motion on, and no
reduced-motion preference), a JS fallback for engines without scroll timelines, and the
archive handed back a page at a time on a 600px `rootMargin`. Every card is still rendered,
so a crawler and a reader with no JavaScript get the whole archive; a `<noscript>` undoes
the hiding where no island can run.

Two things worth writing down beyond the fixes. **`data-chrome-font` and `data-motion` were
never emitted anywhere**, so the mono tracking correction was absent from 2.0 entirely and
the owner's Motion switch had done nothing since it was ported. And **Cloudflare is caching
the staging HTML**: a post page came back `cf-cache-status: HIT` pointing at a bundle two
deploys old, which cost an hour of chasing a bug that had already been fixed. Verify
against the origin, not through the edge, until auto-purge is set up.

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

**The writing surface was set in the wrong face.** `.prose{font-family:var(--font-reading)}`
lived in the PUBLIC sheet, which the admin does not load, so the editor fell back to the
chrome font: a post drafted in JetBrains Mono was published in Literata. The rule now sits
with the rest of the `.prose` rules in `prose.css.ts`, which both sheets share. Measured
after the fix - editor and article agree to the pixel: Literata, 18.08px, 29.832px line.

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



## 2026-07-29 — the code chrome stopped at the rail

The owner asked what else the IDE switch could do, and named the two places it plainly did
not reach: the related posts and the comment thread. That was the whole shape of it. An
article read as source code for two inches of left gutter and then gave up — the series
head, the tags line, the related list, the sign-up card and the thread below them were all
furniture and all of them bare.

It is one selector list now, and adding a chrome heading without marking it is a visible
omission rather than a silent one. What went with it:

- **Counts are bracketed everywhere**, not only in the rail. The sidebar renderer was
  typing its own parentheses, so the taxonomy read `(7)` three lines under a list that read
  `[7]` and nothing in the sheet could reconcile them. Both pairs come from CSS now, which
  is also what keeps the switch reversible.
- **`[n]` means index, `/` means path.** The owner asked whether the feed's right gutter
  should take brackets or a slash: it takes the slash, because a year over its months is a
  hierarchy and every bracket on the site already means "how many". The sticky year reads
  `2026/` and the month markers under it are the next segment.
- **Tags and categories became an array literal**, the related posts and the parts of a
  series took an index column.
- **Markup gained only what CSS cannot invent**: `.num` round a figure so the digits colour
  apart from their unit, `.term-list` round a run of terms. Both are invisible with the
  switch off, which is exactly how a wrapper gets tidied away and takes a feature with it,
  so both ends are tested.

Found on the way out, and fixed separately: **every deploy that changed the stylesheet left
readers on an unstyled site for up to eleven minutes.** Public HTML is `s-maxage=60,
stale-while-revalidate=600`, so a shared cache keeps handing out the previous deploy's page,
and the only stylesheet that page names is a hash the new process does not have. It was a
404. Any `/assets/site.<hash>.css` now answers with the current sheet — markup one deploy
old rendered with CSS one deploy new is a far smaller failure than no CSS at all. Bundles
keep the strict 404, because stale JS can call into markup that moved.

Checked on a local instance seeded to match the live settings (Vietnamese, JetBrains Mono
chrome, the switch on, 720px column): eleven posts across two years, a three-part series,
a paginated archive and an empty term page, in both palettes. The deployed bytes were then
verified at the origin rather than through the CDN.

## 2026-07-29 — the article's right gutter finally has a job

The owner asked whether the tags, the categories, the related posts and the sign-up card
should move into the empty right gutter of an article. Half of them should. Tags and
categories are short labels about the file rather than content, which is what a margin is
for; a related-post title is a long Vietnamese headline that wraps to five lines at 250px
and stops being marginalia, and the sign-up card is a form that needs the width. The owner
took that split and added the meta line to it, so the right gutter now carries the date,
the word count, the reading time, the way into book mode, and then the taxonomy — one fact
per line, because 250px is too narrow for a run of middots and the wrap lands mid-phrase.
The article header on a desktop is now the title and the deck, and nothing else.

**It does not scroll with the article**, on the owner's instruction and for a concrete
reason: a sticky panel would ride down the gutter and sit on top of any wide image, which
noses out into that same gutter by one rail width.

That turned out not to be enough. A post that OPENS with a `#wide` image printed the panel's
tag rows straight across the picture — photographed, not reasoned about. So a wide image or
video in the first two blocks now stays in the column. Two blocks rather than one because
the panel runs to six rows and the header is only the `h1` when the deck is switched off,
which puts the second block level with it too. A wide image further down still noses out,
which was checked separately.

Mobile is unchanged, which was the owner's condition and the reason the same facts are in
the markup twice: below the breakpoint there is no gutter, the panel is `display:none`, and
the meta line and the taxonomy sit exactly where they always did. Measured at three widths —
1584, 1184 and 500 — and at each one precisely one copy has a box, so a screen reader is
never read the date twice. Two consequences worth remembering:

- `book.ts` bound the FIRST `[data-book-open]`. There are two now and only one has a box, so
  the button was dead on whichever layout lost the coin toss. It binds all of them.
- The contents list's last row jumped to `#post-tags`, an id on a paragraph that is now
  hidden on every desktop — and an anchor with no box cannot be scrolled to, so that row
  would have died silently. The anchors are their own empty elements at the end of the
  article now.

Also this round, from the owner: the meta line's date and figures take the same brackets as
everything else, with **the brackets a shade lighter than what they hold** — they are
punctuation, not the value, and at equal weight the line reads as a row of boxes. And the
rail's term counts, which were a filled ring for one deploy on the argument that a term
cloud has no sequence to punctuate, are brackets again. The owner looked at the ring and
said it was ugly. One bracket for every literal is the simpler rule anyway.

## 2026-07-29 — the info panel, second pass, and tags that look like tags

Six corrections from the owner, all of them on the round just shipped.

**The three columns were not level**, and the cause was a margin doing a job that no longer
existed: the title carried `mt-2` to space it away from the meta line, and the meta line is
now in the right gutter. Both rails start their first line at the same `y`; the title sat
8px below them. Measured with a Range rather than a box top, because a 32px title and a 15px
chrome line have different half-leading and three boxes that start together still look
ragged. Removed at that width only.

**In the panel:** the values are `--c-heading` now, a step darker than the words around
them — the same ink the contents list gives the row you are on, which is what the owner
asked for. The tags and categories lost their extra gap, so the facts run at one even
rhythm. Book mode moved to the foot with air above it, in `//` and set a little stronger:
it is the only row in the panel that DOES something rather than states something, and that
is the reason it is the one row set apart. The order is asserted in a test rather than left
to whoever edits next.

The owner asked whether a dot on the divider would help. It does: `--c-rule` measures
1.16:1 against the page and all but vanishes over a run as short as this panel, and the
feed's timeline already answers exactly that with a dot on a hairline. Both gutters now
speak one language.

**Tags read as tags.** `tagText()` replaces the spaces inside a tag with hyphens wherever a
tag is shown — the cloud, the article footer, the panel, the archive heading. The problem
was real and specific: "viết mẫu giao diện typography hiệu năng" is a sentence, not five
tags, and there is no way to see where one ends. Hyphenated, each is one unbroken token and
the run needs no separator, chip or box. Display only: the stored term, the slug and every
link keep the real name, which is tested from both ends. Categories are proper names and
are left alone. The Vietnamese label is "Tag" now rather than "Thẻ", which the owner reads
as ambiguous.

**And the `//` came off the comment invitation.** "Be the first to comment" is addressed to
the reader; the marker belongs on labels.

## 2026-07-29 — the cache, measured rather than assumed

The owner asked for a performance pass and, separately, for editing a post or deploying to
actually clear the cache. Both turned out to be the same problem, and both were worse than
anyone had written down.

**A cold article render is 92 to 383ms, not the fraction of a millisecond the design
assumed.** Profiled on the live box against a copy of the real database: for an
85,000-character post `renderPostContent` is 359ms of a 364ms page render, and inside that
`marked.parse` alone is 360ms. It is marked itself, not our renderer or our options — a
plain `Marked` with no configuration is the same 375ms. Every write anywhere empties the
page cache (Invariant 1), so that cost landed on the next reader, every time.

So the rendered body joins the highlighter in `render_cache`, content-addressed: keyed by
the build commit, the media facts and the markdown. `01-schema.md` argued against exactly
this — "a body cache would have to key on media variants, theme and locale, which is the
invalidation graph Invariant 1 avoids" — and two thirds of that was wrong. The theme is CSS
and never reaches the body HTML; neither does the locale. The media facts are real, and they
are IN the key rather than invalidated out of it, which is the trick the highlighter was
already using. The build commit is in there so a deploy that changes a transform cannot
serve yesterday's HTML out of a cache with no way to tell.

**The Cloudflare purge was dead configuration.** `cloudflareApiToken` and `cloudflareZoneId`
have been in `integration_keys`, in the schema and in the Admin UI since the import, and
nothing in 2.0 ever read them: the port dropped the call and kept the panel. Measured
through the CDN before the fix, `cf-cache-status: HIT` with `Age: 165` against
`s-maxage=60, stale-while-revalidate=600` — the edge really does hold this site's HTML, so
an edit stayed out there for up to eleven minutes. `purgeEdge()` now exists and is called.
Unconfigured is a no-op, which is the normal state of a self-hosted install and of every
test.

**And the cache re-fills itself.** `clearCache()` grew a hook list; the server entry point
registers a debounced warm-then-purge, so a burst of writes gets one pass and an import that
saves 200 posts does not warm 200 times. Warm first, purge second, so the edge refetches
into a warm origin. It also runs on boot, which is what makes a deploy clear the edge
without anyone remembering to do it. The hooks are registered from `index.ts` and not from
`clearCache()` itself, so a test suite that flushes several hundred times gets a plain
`Map.clear()` and nothing else.

**Responses now leave the origin gzipped.** Nothing ever set `content-encoding`: the 61 KB
stylesheet, every page and every feed went out raw on each origin fetch. Text only, over
1 KB only, and `Vary: Accept-Encoding` with it.

Two things found on the way that were not on anyone's list:

- **`highlight.ts` contained literal NUL bytes.** The cache key was built as
  `${lang}\0${theme}\0${code}` with the separators typed as actual NUL characters instead of
  the escape. Nothing broke at runtime, which is why it survived; the damage was to the
  tools. `grep` reported the file as binary and refused to search it, `git diff` showed
  `Bin 3642 -> 2947 bytes` instead of a diff, and an exact-match edit against text copied
  out of the file silently failed to apply. There is a `check:nul` now.
- **`check:routes-guarded` matched `headers.delete('content-length')`** in the new
  compression middleware and reported it as an ungated DELETE route. A route path in Hono
  starts with `/`; the guard now requires that. A guard that cries wolf is a guard that gets
  switched off, and this one is load-bearing.

## 2026-07-29 — the header controls, the index nesting, and the chrome font

Three from the owner, with one condition restated: **the IDE style applies only when the
switch is on. With it off the site is exactly what it was.** Everything below honours that
the same way the info panel does — both forms are in the markup and the sheet decides which
one has a box.

**The header controls.** Four round line-art glyphs were the last thing on the page still
speaking the language of a phone app. With the switch on they become
`[/tìm] [tối] [lưới] [@email]`, brackets from the sheet as every other literal on the site.
Only from 640px up: five words are far wider than five 40px squares and would wrap the
header on a phone, so below that the icons stay.

**The index nesting was wrong in two ways at once.** It said "sub-heading" with a smaller
size and a bullet on the PARENT, and at a glance neither reads — the two sizes are close and
the bullet sits at the far end of a right-ranged row. And the numbers ran 1..12 straight
through, so a sub-heading of section 2 was numbered 7 and looked like a section. A child is
a path segment now: same size and weight, a leading `/`, and numbered within its parent
(`2.1`).

That took `counter-set` rather than `counter-reset`. A reset on the parent row creates a new
counter instance scoped to that row and its following siblings, and the children go on
reading the outer one — measured, the index ran `1.1 1.2 2.3 2.4 2.5 3.6` before the fix.

**The chrome font is preloaded now, and the rule that said never to has been reversed.**
That rule was written when the chrome font was Inter and the fallback a system sans, so the
swap was barely visible. It is a monospace on any site that picks one, and the header, the
meta line and both rails all re-flow when it lands. Measured at the origin, cold, 4x CPU
throttle, median of five runs:

| | LCP | CLS |
|---|---|---|
| no chrome preload | 472 ms | 0.0004 on four runs of five |
| chrome face preloaded | **472 ms** | **0 on all five** |
| Inter preloaded by mistake | 632 ms | 0.0004 |

Free in LCP, and it removes the shift. The third row is the trap and I walked into it while
measuring: `getChromeFont` falls back to Inter for an unknown id, which is right for the
font STACK and wrong for a preload — 44 KB the page never paints a glyph in, and 160 ms of
LCP. The argument is now `chromeFont: string` with no default, and an id that is not a known
one preloads nothing.

## 2026-07-29 — two bugs in the round just shipped

**The active marker and the index's slash were fighting over one pseudo-element.** A ToC row
is `.rail-row` AND `.rail-lead` or `.rail-sub`, and all three wanted `::before`: the bullet,
the new leading `/`, and the accent hairline marking the row you are level with. The
marker's empty `content` won and the slash came out painted in the accent colour as a red
diagonal at the row's right edge, which is what the owner photographed. The marker moves to
`::after` — four rules. It also fixes a latent version of the same bug in the base chrome,
where an active parent row had been quietly losing its bullet.

**The header tokens rendered at the BODY size.** `.icon-btn` states no size of its own: it
was built around a 20px SVG, which does not care, and the moment a WORD went in it inherited
18px. Five large words spread wide. Measured after: 14.08px, and the whole control row 256px
instead of sprawling.

And a fourth backtick in a CSS template literal, in a comment quoting `content` with an
empty string. The server refused to boot. `check:css-literal` catches it; I ran `check:type`
first and read the wrong green tick.

## 2026-07-29 — where the day ended

Eleven commits after the audit round, `0ae64dc` through `996e133`, all deployed and verified
at the origin. `check:all` green at 1,056 tests. **No version bump and no tag** — that is the
owner's call and was not asked for.

What changed, in one list:

- **The IDE chrome went from the rail to the whole page** and then through four rounds of
  the owner's corrections: `//` on every chrome label, `[...]` on every literal with the
  brackets a shade lighter than what they hold, `/` for a path, an index column on the
  related list and the series, and finally `[/tìm] [tối] [lưới] [@email]` in place of the
  header icons. Every one of them behind the one switch, with both forms in the markup, on
  the owner's restated condition: **with it off the site is exactly what it was.**
- **The article's right gutter became a panel** carrying the date, the length, book mode and
  the taxonomy — desktop only, not sticky, and with a wide image in the first two blocks
  kept out of it.
- **A tag now reads as a tag**: hyphenated for display everywhere, untouched underneath.
- **The render pipeline was measured for the first time** and the answer was 360 ms of
  `marked` per long post, paid again after every write. The body is content-addressed now:
  383 ms → 1 ms.
- **The Cloudflare purge was dead configuration** and is live. **The cache re-fills itself**
  after a write and on boot. **Responses leave the origin gzipped.**
- **The chrome font is preloaded**, reversing a documented rule, with three measured
  configurations behind the reversal.

Six things were found that nobody had reported, and all six are fixed: a deploy left readers
on an unstyled site for eleven minutes; `book.ts` bound only the first toggle; the ToC's last
row pointed at an anchor with no box; every phone-width meta line ended on a stray middot;
`highlight.ts` contained literal NUL bytes that made `grep` and `git diff` refuse to read it;
and `check:routes-guarded` reported `headers.delete(...)` as an ungated route.

Three new guards and one new check: `check:nul`, the route-path tightening, the body-cache
tests, and the compression tests.

**Open, unchanged from this morning:** the CI workflow still needs the owner's hand (token
scope), the instance data is still in `scripts/ops/`, and the seven-day watch on
`old.manhhung.me` is still running.
