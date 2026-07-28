# Worklog

Newest first. What happened, not what is true now (that is `docs/`) or what is next (that
is `TASKS.md`). Keep entries short; the detail is in the commit.

Older entries roll into [`worklog/`](worklog/2026-07-quire-2-rewrite.md) when this file
passes its size cap. Rolling is a move, never a rewrite.

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


