# Audit, 2026-07-29 (second pass) — typography, security, performance

Snapshot. Write-only: not retro-edited. Follows `2026-07-29-post-cutover.md`, which was
the same day and covered different ground; nothing here contradicts it.

Scope: the owner's typography settings, the reader's stylesheet, security, and code
correctness. Everything below was **measured** with headless Chromium against a throwaway
instance on port 3199, seeded with a specimen post that carries every text role on one
page. No request touched production. `bun run check:all` was green before and after
(1003 → 1010 tests).

## The finding behind most of the others

**Eight surfaces took a type role's SIZE and inherited everything else**, so the owner's
line-height and letter-spacing for those roles moved nothing at all. Measured on the
specimen page, rendered vs the role the setting defines:

```
surface           role      leading rendered / set     tracking rendered / set
figcaption        caption        1.7  /  1.5                  —
.footnotes li     small          1.7  /  1.6                  —
inline code       code           1.7  /  1.6                  —
pre code          code           1.7  /  1.6                  —
.rail-sub         caption        1.6  /  1.5                  —
header .tagline   small          1.7  /  1.6                  —
footer.site       small          1.7  /  1.6                  —
.code-copy        caption        1.7  /  1.5                  —
header .title     h4              —                        0 / -0.01
.deck             h4              —                        0 / -0.01
```

Every one of them *looks* wired: the rule names `var(--fs-<role>)`. That is why review
never caught it and why the fix is a check rather than ten edits. `check:type` now fails a
rule that takes `font-size: var(--fs-X)` without `line-height: var(--lh-X)` and
`letter-spacing: var(--ls-X)`, with a listed-exception map. Canaried: reverting one line of
`figcaption` fails the build.

Adding the tracking broke something else first, which is worth recording: those chrome
surfaces used to INHERIT the mono-chrome tracking correction from `body`, and a rule that
states the property stops inheriting. This site runs a mono chrome, so pinning them would
have loosened the whole chrome. `MONO_TRACKING` now lists them (`render/font-faces.ts`).

Listing them also exposed the inverse, which had been true all along: `figcaption` and
`.footnotes` sit inside the article and render in `--font-reading`, and with no tracking of
their own they were inheriting a MONO adjustment while painting in Literata — measured at
-0.05em under a JetBrains Mono chrome. Same for a comment body. They take their own role
tracking now, and both halves are pinned in `web/typography.test.ts`:

```
                    chrome (JetBrains Mono)     reading (Literata)
  footer  -0.05        prose p      0
  tagline -0.05        prose h2    -0.01   (its own --ls-h2)
  rail    -0.05        figcaption   0      (was -0.05)
  related -0.05        footnotes    0      (was -0.05)
```

## A heading did not belong to its own section

Heading top margins are a multiple of the HEADING's own size; the space below is the
following paragraph's lead, a fixed multiple of the BODY's. The two converge as the level
drops, and at h5 they inverted:

```
        before (above / below)      after
  h2        44 / 22                44 / 14
  h3        32 / 25                36 / 11
  h4        28 / 25                32 / 11
  h5        22 / 25   ← inverted   27 / 11
```

## The same `code` role rendered in two different faces

`prose.css.ts` asked for `var(--font-mono, ui-monospace, monospace)` on `pre code`, and
**`--font-mono` was defined nowhere** (already on `TASKS.md` as "define it or drop it").
Inline code inherited the reading font. So one page showed inline code in Literata and a
fenced block three lines later in whatever `ui-monospace` meant on that machine.

Owner's call: a real mono. `--font-mono` is now JetBrains Mono, self-hosted, already
shipped for the chrome-font option. Declaring it costs a code-free page nothing —
`unicode-range` means a declaration is not a download:

```
/ban-mau-chu (has code)   jetbrainsmono-latin.woff2  30,164 B
/bai-mau-1   (no code)    not requested
/            (no code)    not requested
```

## Per-preset tuning: one preset's numbers were guessed

Measured at the default 672px column, with each preset's own tuned typography applied:

| preset | body px | x-height | chars/line | leading ÷ x-height |
|---|---|---|---|---|
| Inter | 18.08 | 10.0 | 70 | 3.07 |
| Literata | 18.08 | 9.0 | 71 | 3.31 |
| Source Serif 4 | 18.40 | 9.0 | 72 | 3.31 |
| **Source Sans 3** | 18.40 | 9.0 | **79** | **3.52** |

Two compounding problems, and the old note in `themes.ts` reasoned its way into one of
them. The face is narrow — 7.70px per character against Inter's 8.69 — so the same column
takes nine more characters, past the 45-75 band. And "slightly shorter x-height, so … loosen
the line a hair" is backwards: a small x-height under a long measure is exactly when the eye
loses the return sweep, and 1.72 leading made it the loosest of the four.

**The leading was fixed. The measure was not, and the attempt is worth recording**, because
it is the useful half of this finding. Sizing up until 79 characters came back into band
needed body 1.26rem — which measured beautifully (x-height 10.0, level with Inter; 72
chars/line; leading ÷ x-height 3.27) and **failed two pinned tests in
`web/typography.test.ts`**: `small` must stay above 0.8 of body, and the serifs' secondary
text must stay larger than the sans's. Both rules are right, and they are right for the same
reason: `small` also sets the CHROME, which renders in the chrome font and has no business
growing because the reading face is narrow. Under them the ceiling is ~1.17rem, which moves
the measure by one character.

So what shipped is body 1.16rem with leading 1.62 — **leading ÷ x-height 3.52 → 3.34**,
against the serifs' 3.31 — and the real lever is recorded rather than forced: **the measure
belongs to `contentWidth`, which a preset does not own.** A reader on this preset wants
roughly a 620px column, not 672. Making that a per-preset field is a settings-model change
and is not in this pass.

Two claims in `docs/conventions.md` were measured and are false; the doc now says so.
No preset hits the "~66-char measure" it advertised (70/71/72), and h5 (1.0rem) renders
BELOW body (1.125rem) where the note said it no longer did.

## Reset restored another font's setup

`TypographyFields`'s Reset used `DEFAULT_TYPOGRAPHY` unconditionally — Inter's tuning. An
owner reading in Literata who pressed it silently got a sans's numbers, and the only way
back was to notice and re-click the font tile. It now resets to the chosen preset's own
tuning. Two more in the same panel: the chrome-font grid was `grid-cols-3` holding four
entries since JetBrains Mono was added, and the admin declared only the ACTIVE families —
so **five of the eight font tiles rendered in a fallback face**, in a picker whose whole job
is showing what it offers.

## Performance: 42.6 KB per page that never changed

Of the 48.7 KB of CSS assembled per page, 42.6 KB (13.8 KB gzipped) was byte-identical
everywhere; 6.1 KB (1.7 KB gzipped) varied with settings. Split at that seam — the static
half is `/assets/site.‹hash›.css`, `immutable`, and the settings half stays inline after it
so the cascade is unchanged.

```
HTML per page      home  60,266 → 20,665 B      post  64,984 → 25,383 B
sheet              45,269 B  (14,207 B gzipped), fetched once
LCP (origin, median of 3 cold loads)   home 100 ms · post 132 ms · CLS 0
sheet discovered ~11 ms, complete ~18 ms
```

A loopback measurement cannot price the extra round trip a real network charges on the
FIRST visit. That is the cost this trade accepts, and it is paid once. Rationale and the
"why the inline block must come second" rule are in `docs/performance.md`.

## Security

- **`/api/cron` was an unauthenticated lever on the most expensive work the process can
  do.** One call clears the page cache, calls Cloudflare's purge API, runs sharp over
  pending image variants and may take a full backup of both databases and the uploads tree.
  `CRON_SECRET` unset means open — which is deliberate, so a fresh install's keep-alive
  works — and there was no rate limit at all, on a runtime with one thread. Now capped at
  12/minute per IP, BEFORE the token check.
- **`/search` ran uncached FTS5 with no cap** while `/api/search`, the other half of the
  same feature, was capped at 60/minute. Same cap now, and the handler moved to
  `web/search-page.ts` (`app.ts` was over the 400-line limit).
- **The app sent no security headers.** They are set in nginx by the recommended vhost, so
  the live site has always had them — which made them a property of one deployment's proxy
  rather than of the software. `nosniff`, `X-Frame-Options: DENY` and a referrer policy are
  now sent by the app, never overwriting an existing value. **Deliberately not CSP:** a
  browser enforces the intersection of every CSP it receives, so a second policy from the
  app would silently narrow a proxy's tuned one.
- **`/og` derived its own origin from the `Host` header**, which the client sends. With
  `Host: 127.0.0.1:9200` the same-origin test approved `bg=http://127.0.0.1:9200/…` and the
  route fetched it server-side and painted it into the card. It now prefers `SITE_URL`,
  read from the environment so the route keeps the property that makes it cheap: it touches
  no database.

## Two guards that were not guarding

- **`check:css-literal` did not scan `prose.css.ts`**, whose own header says it does. The
  file was split out of the public sheet carrying that sentence and never added to the
  list — which the check's own comment warns about happening once already. The fifth
  backtick got through during this audit, in a comment, and the check reported ok while the
  server refused to boot. Added, and canaried.
- **`check:routes-guarded` only scans write METHODS.** `/api/cron` is a GET that publishes
  posts, purges caches and takes backups. It is on the public list anyway, so nothing
  escaped — but a GET that writes is invisible to that guard by construction. Noted, not
  changed.

## Also fixed

Two strings were hardcoded English on a site that ships six languages: the search page's
`N results for "q"` (with an English plural rule) and the pager's Newer/Older. Both are
locale keys now, filled in all six.

## Checked and clean

- SQL: no string building outside the declared exception. `any`: none in production code.
- Sessions: token hashed at rest, `__Host-` cookie, sliding 30d / absolute 90d, IP salted.
- CSRF: `Sec-Fetch-Site` first, `Origin` vs the arriving `Host` as fallback, neither
  present is a refusal. Sign-in lockout counts FAILURES only.
- `settings.customCss` is stripped of `</style` before it reaches the page; uploaded font
  family and `src` are both sanitised before they reach a `@font-face`.
- Upload path traversal: `..%2f..%2fpackage.json` 404s, and is a test.

## Noted, not changed

- **A blockquote is set in `--c-meta`** — 4.56:1 on the Mono light palette, the weakest
  CONTENT text on the page (body is 14.75:1). It clears AA, and it is a deliberate look,
  but a pull quote is the reader's own words rather than metadata.
- **The app still sends no `content-encoding`.** nginx compresses in front of it here. The
  split above cut the uncompressed page from ~65 KB to ~25 KB, so the exposure is a third
  of what it was, but a self-hoster behind something that does not compress is still
  serving three times the bytes with no warning. Still on `TASKS.md`.
- **`/api/health` has no rate limit.** It is two cheap checks and rate-limiting a probe can
  take an instance out of rotation, so this is a decision rather than an oversight.
- **`.to-top` carries no `font-size`** and renders its glyph at the body size where
  `.code-copy` uses `--fs-caption`. Both are icons in hit targets; the inconsistency is
  cosmetic and `check:type` cannot see a rule that sets nothing.

## Postscript — looking at the owner's OWN settings, not a preset

Everything above was measured against seeded settings. The live site's are different, and
two of the differences matter. Read off `manhhung.me` and reproduced locally:

```
contentWidth 720 (not the 672 default)      reading Literata · chrome JetBrains Mono · vi
body 1.13/1.65   small 0.88/1.55   caption 0.81/1.5   code 0.88/1.6   h1 2.0 ls -0.01
```

**One more face seam, and the most visible one on the site.** `.deck` — the standfirst
under a post title — is the post's EXCERPT, the same string a list card prints. A card
prints it in the reading font. The deck had no family of its own, so it fell to
`--font-sans`: on this blog that is JetBrains Mono. Every post therefore opened with a book
serif headline and a terminal subtitle, one line apart. Fixed, and it came out of
`CHROME_TRACKED` with the other two reading surfaces. Same class as the comment body.

**The measure is 76 characters, not 71.** `contentWidth` 720 gives a 656px column; at
Literata 18.1px that is 76 characters per line, past the 45-75 band and past what any
measurement in this file assumed. ~690px would land it at 72. The owner's setting, so it is
reported rather than changed.

**Secondary text is finer than any preset allows.** `small` is 0.88rem against a 1.13rem
body — a ratio of **0.78**, below the 0.8 floor `web/typography.test.ts` pins for every
built-in preset, and `caption` is 0.81rem (13.0px). At `--c-meta` that puts the caption,
the blockquote and the whole chrome at **4.56:1**, a sixteenth of a point above the AA
minimum. Nothing fails; but the smallest text on the page is also the palest, and a book
separates secondary matter by size and space while keeping the ink.

**The article page is 290px out of balance.** Ink spans x=102 to x=1048 in a 1440 viewport:
102px of margin on the left, 392px on the right, because the rail fills the left gutter and
nothing fills the right. A listing is much closer (102 vs 240) because the year timeline
occupies the right gutter. The reading column itself is centred to the pixel — it is the
PAGE that is not. Deliberate (the rail is "type on the page", ADR-level) and therefore the
owner's call, not a defect to fix silently.

## Postscript 2 — book mode had never been larger than the article

The owner asked for the book-mode formula to be fixed and recorded: reading text 15% larger
than the article, every gap scaled with it. Measuring the current behaviour before changing
it found that **the first half was not happening either**. Article against book mode, on the
owner's own settings:

```
                body  leading  h2   para gap  pre pad  quote indent  figure  td pad
  ratio before  1.000  1.000  1.000  1.000    1.000     1.000        1.000   1.000
  ratio after   1.150  1.150  1.150  1.150    1.150     1.150        1.150   1.150
```

`--type-scale: 1.15` was set on `.book-overlay` and read back as `1.15` there — and
`--fs-body` still computed to `calc(1.13rem * 1)` inside it. **A `var()` inside a custom
property is substituted where the property is DECLARED, not where it is used.** `--fs-body`
declared on `:root` resolves the scale against `:root`, where it is undefined, and the
resolved value is what inherits. Proven in the browser rather than argued:

```
  #a { --scale:1; --unit:calc(10px * var(--scale,1)) }   ->  calc(10px * 1)
  #b { --scale:2 }                         (inherits #a) ->  calc(10px * 1)
  #c { --scale:2; --unit:calc(10px * var(--scale,1)) }   ->  calc(10px * 2)
```

`settings.ts` carried a comment asserting the opposite, and `docs/conventions.md` stated it
as a hard rule. `typographyToCss` now emits the identical block on `:root` AND on
`.book-overlay`, which re-substitutes it there. The nine article gaps that were frozen in
`rem` became multiples of a new `--sp`, which carries the scale the same way.

**The running head was set at -0.7px a character.** The book overlay is the reading face
throughout — its running head is the article's own title — but it stated no tracking, so it
inherited the mono-chrome correction from `body` and rendered a book serif at -0.05em. That
is what "the letters are too close together" was. The overlay states `--ls-body` now, and
`.book-title` / `.book-count` came out of `CHROME_TRACKED`.

## Postscript 3 — the section break, and an IDE chrome behind a switch

Two design decisions taken by the owner on 2026-07-29.

**The article's section break is now a short centred rule** (6em, air above and below).
A book does not rule a line across the text block to change subject. The full-width rule
stays for the structural separations, which are a different job: the footnote rule, the
comment thread, the pager. In book mode it remains the asterism.

**`settings.ideChrome`** dresses the furniture as source code while the reading column
stays analogue: `//` markers on rail headings, bracketed counts and dates in `--c-accent`,
and an editor line-number gutter. Server-rendered as `<html data-ide-chrome="on">`, so no
island runs and there is no flash. Three properties are tested rather than described: every
rule is behind the attribute so off leaves no trace; nothing touches `.prose`,
`.reading-font`, `.deck`, `.comment-body` or `.fs-*`; and the only colours are the two
theme tokens an editor actually distinguishes, comment and literal.

Two things the measurement decided rather than taste. The rail **ranges left** under the
switch — in the gutter layout it ranges right so its text hugs the article, which is correct
typography and exactly wrong for a line-number gutter; and `text-align` alone does nothing
to a flex item, `justify-content` is what ranges the row. And the gutter is **legible**
(`--c-meta`, 4.56:1): `--c-rule` measured 1.16:1 against the page, which is invisible, and a
generated counter is still announced by some screen readers. What makes a gutter a gutter is
where it sits and that its figures are tabular.
