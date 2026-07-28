// The public stylesheet, hand-written (ADR 0008: no Tailwind on the public site).
//
// It is a string rather than a `.css` file because it is INLINED into every page, which
// removes a request from the critical path. That only stays a good idea while the sheet
// is small, which is the point of writing it by hand: a utility framework's output cannot
// be inlined without shipping the parts this site does not use.
//
// Every colour comes from a theme token (`--c-*`, set by `themesToCss`) and every size
// from a type role (`--fs-*`, set by `typographyToCss`). No hardcoded hex, no hardcoded
// px sizes: that rule survives from the frozen tree's conventions and is what keeps the
// palette switcher and the typography settings actually wired to something.


import { ISLANDS_CSS } from '@/web/islands.css'

const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
/* TWO font handles, and which one is the DEFAULT matters more than it looks. --font-sans
   is the system chrome face: header, footer, rail, dates, reading times, everything that
   is not the reader's own words. --font-reading is the reader's words, and it is opted
   INTO by .prose and .reading-font. This said --font-reading, so the whole site rendered
   in the article face and the owner's chrome font was never seen anywhere. */
body{
  margin:0;background:var(--c-bg);color:var(--c-text);
  font-family:var(--font-sans);font-size:var(--fs-body);line-height:var(--lh-body);
  letter-spacing:var(--ls-body);font-optical-sizing:auto;
}
img,video,iframe{max-width:100%;height:auto}
a{color:var(--c-link);text-decoration:underline;text-underline-offset:.15em}
a:hover{color:var(--c-heading)}
hr{border:0;border-top:1px solid var(--c-rule);margin:2.5rem 0}

/* The column width is --shell-w, not a constant: the layout sets it from the owner's
   contentWidth and a two-rail listing overrides it with something narrower. It read
   --content-width, which nothing ever set, so every page has been 42rem wide regardless
   of the setting.

   The 2rem gutter is the same at EVERY width, which the frozen tree's markup does not
   admit: it says "px-8 sm:px-5", but no .sm\\:px-5 rule was ever compiled into its
   stylesheet, so 2rem is what actually shipped. Measured off the rendered page, not read
   off the class list — the two disagreed by 24px of column, which is one word per line. */
.wrap{max-width:var(--shell-w,42rem);margin:0 auto;padding:0 2rem;
  display:flex;min-height:100vh;flex-direction:column}
/* The rail is absolutely placed against THIS box, not the page, so it never displaces the
   reading column and the column stays centred exactly as it does with no rail at all. It
   wraps the content and not the header, which is what puts the rail's first line level
   with the article's first line. */
.with-rail{position:relative;display:flex;flex:1;flex-direction:column}
main{flex:1;padding:3rem 0 1rem}

header.site{padding:1.75rem 0}
header.site .title{font-family:var(--font-sans);font-weight:600;color:var(--c-heading);
  text-decoration:none;font-size:calc(var(--fs-h4) * var(--type-scale, 1));line-height:var(--lh-h4)}
/* width+height on the tag reserve the space, so the header does not jump when the logo
   arrives; the CSS width keeps it responsive and height:auto keeps the ratio. */
header.site .logo{display:block;height:auto}
header.site .tagline{color:var(--c-meta);font-size:var(--fs-small);margin:.75rem 0 0}

/* The body is the reader's OWN words, so it takes the reading face. There is deliberately
   no "article h1" rule: an article IS also the listing card, and a bare element selector
   here silently restyled every card title. Sizes come from the type-role classes. */
.prose{font-family:var(--font-reading)}
article > header h1{color:var(--c-heading);margin:0}
article > header .t-small{margin:0}
/* Standfirst: the excerpt, so a long read opens on a sentence rather than a wall. */
.deck{margin:1rem 0 0;color:var(--c-meta);
  font-size:calc(var(--fs-h4) * var(--type-scale, 1));line-height:var(--lh-h4)}
#post-body{margin-top:2.5rem}
/* Tags and categories over a rule: the rule is where the article ends. Without it the
   taxonomy reads as one more paragraph. */
.post-taxo p{margin:0 0 .25rem;scroll-margin-top:6rem}
.related h2{font-size:calc(var(--fs-small) * var(--type-scale, 1));font-weight:600;
  color:var(--c-meta);margin:0 0 1.25rem}
.related ul{list-style:none;padding:0;margin:0}
.related li + li{margin-top:1rem}
.related a{font-weight:500}
.related p{margin:.125rem 0 0}
article + .subscribe-card,article + #comments{margin-top:2.5rem}

/* The body's rhythm is ONE rule: every sibling gets the same lead, and the headings then
   buy themselves a little more. Margins were bottom-side and fixed in rem here, which does
   not scale with the reader's type size and left headings floating between paragraphs. */
.prose{font-size:calc(var(--fs-body) * var(--type-scale, 1));line-height:var(--lh-body);
  letter-spacing:var(--ls-body);color:var(--c-text)}
.prose > * + *{margin-top:1.4em}
.prose h1,.prose h2,.prose h3,.prose h4,.prose h5{color:var(--c-heading);font-weight:600;
  scroll-margin-top:2rem}
.prose h1{font-size:calc(var(--fs-h1) * var(--type-scale, 1));line-height:var(--lh-h1);
  letter-spacing:var(--ls-h1);margin-top:1.9em}
.prose h2{font-size:calc(var(--fs-h2) * var(--type-scale, 1));line-height:var(--lh-h2);
  letter-spacing:var(--ls-h2);margin-top:1.85em;margin-bottom:-.15em}
.prose h3{font-size:calc(var(--fs-h3) * var(--type-scale, 1));line-height:var(--lh-h3);
  letter-spacing:var(--ls-h3);margin-top:1.6em}
.prose h4{font-size:calc(var(--fs-h4) * var(--type-scale, 1));line-height:var(--lh-h4);
  letter-spacing:var(--ls-h4);margin-top:1.5em}
.prose h5{font-size:calc(var(--fs-h5) * var(--type-scale, 1));line-height:var(--lh-h5);
  letter-spacing:var(--ls-h5);margin-top:1.4em}
/* Bold is EMPHASIS in the body colour. A book serif's 700 is blacker than the 600 of the
   headings, so a preset can dial it back through --reading-bold. */
.prose strong,.prose b{font-weight:var(--reading-bold, 700)}
/* A body link carries a permanent faint rule that warms to the accent on hover, which is
   the opposite signature to the chrome links (.link-accent) and deliberately so. */
.prose a{color:var(--c-link);text-decoration:underline;text-underline-offset:.18em;
  text-decoration-thickness:1px;text-decoration-color:var(--c-rule)}
.prose a:hover{text-decoration-color:var(--c-accent)}
.prose ul{list-style:disc;padding-left:1.4em}
.prose ol{list-style:decimal;padding-left:1.4em}
.prose li{margin:.25rem 0}
.prose blockquote{border-left:2px solid var(--c-rule);margin-left:0;padding-left:1rem;color:var(--c-meta)}
/* ONE typeface site-wide: inline code reuses the reading font a touch smaller, on a tinted
   slab. A separate monospace family here would be a second face nobody chose. */
.prose code{font-family:inherit;font-size:calc(var(--fs-code) * var(--type-scale, 1))}
.prose :not(pre) > code{background:var(--c-rule);padding:.15em .38em}
.prose pre{padding:1rem;border-radius:.5rem;overflow-x:auto;font-size:var(--fs-code)}
.prose pre code{font-size:inherit;font-family:var(--font-mono,ui-monospace,monospace)}
.prose hr{margin:2.4em 0}
.prose table{border-collapse:collapse;width:100%}
.prose th,.prose td{border:1px solid var(--c-rule);padding:.4rem .6rem;text-align:left}

/* BOOK TYPOGRAPHY (features.bookText). A printed book leads a paragraph with nothing but
   an indent; on screen that reads as a wall, so a small lead stays. A paragraph that OPENS
   something is never indented — the indent says "this continues", and after a heading
   there is nothing to continue from. */
.book-text .prose p{margin-top:.65em;text-indent:1.6em}
.book-text .prose > p:first-child{text-indent:0}
.book-text .prose :is(h1,h2,h3,h4,h5,blockquote,figure,pre,ul,ol,hr,table,.gallery,.video-embed) + p{
  text-indent:0;margin-top:1.4em}
.book-text .prose li p,.book-text .prose blockquote p{text-indent:0}
@media (min-width:600px){
  .book-text .prose p,.book-text .prose li{text-align:justify;hyphens:auto}
}

/* An archive heading is chrome, not the reader's words: it stays in --font-sans and it is
   BOLD, where a post title is 600. Both come from the frozen tree's own markup. */
.listing-head{margin:0 0 2rem}
.listing-head h1{font-size:calc(var(--fs-h1) * var(--type-scale, 1));line-height:var(--lh-h1);
  letter-spacing:var(--ls-h1);color:var(--c-heading);margin:0;font-weight:700}
.lower{text-transform:lowercase}
/* Type ROLES, ported from the frozen tree. A card composes these rather than declaring
   its own sizes, which is why the listing and the article agree without anyone keeping
   two numbers in step. Every size is the owner's --fs-* setting times --type-scale, so
   nothing here is a literal. */
.fs-h1{font-size:calc(var(--fs-h1) * var(--type-scale, 1));line-height:var(--lh-h1);letter-spacing:var(--ls-h1)}
.fs-h2{font-size:calc(var(--fs-h2) * var(--type-scale, 1));line-height:var(--lh-h2);letter-spacing:var(--ls-h2)}
.fs-h3{font-size:calc(var(--fs-h3) * var(--type-scale, 1));line-height:var(--lh-h3);letter-spacing:var(--ls-h3)}
.t-small{font-size:calc(var(--fs-small) * var(--type-scale, 1));line-height:var(--lh-small);letter-spacing:var(--ls-small)}
.t-body{font-size:calc(var(--fs-body) * var(--type-scale, 1));line-height:var(--lh-body);letter-spacing:var(--ls-body)}
.text-meta{color:var(--c-meta)}
.text-text{color:var(--c-text)}
.reading-font{font-family:var(--font-reading)}
.font-semibold{font-weight:600}
.mt-2{margin-top:.5rem}
.mt-3{margin-top:.75rem}
/* ONE hover signature for every link outside the body copy: an accent underline. */
.link-accent{color:var(--c-heading);text-decoration:none}
.link-accent:hover{text-decoration:underline;text-decoration-color:var(--c-accent);
  text-decoration-thickness:1px;text-underline-offset:4px}

/* Cards are separated by SPACE, not by a rule. The border-bottom here was mine, not the
   frozen tree's, and it turned a quiet feed into a table. The gap has to be wide enough to
   read as a break rather than a paragraph space, which is what 4rem buys. */
.post-list{display:flex;flex-direction:column;gap:4rem}
.post-list > article > p:first-of-type{margin:0}
/* The timeline groups its cards by year, so the gap moves onto the cards themselves: the
   year marker is zero-height and sticky, and a flex gap would still reserve a row for it. */
.post-list.tl-feed{display:block}
.tl-feed .tl-yr article{margin-top:4rem}
.tl-feed > .tl-yr:first-child > article:first-of-type{margin-top:0}
[data-list=grid] .tl-yr{display:contents}
[data-list=grid] .tl-feed article{margin-top:0} /* the grid supplies its own gap */
.tl-mark{align-items:center;gap:.5rem;white-space:nowrap;color:var(--c-meta)}
/* The sticky year is a --c-bg tag, so months sliding up to the top pass UNDER it and
   disappear instead of overlapping; the right padding widens the mask to cover the
   longest month label. */
.tl-year-tag{align-items:center;gap:.5rem;white-space:nowrap;color:var(--c-heading);
  font-weight:600;background:var(--c-bg);padding:.1rem 3rem .1rem 0;
  font-size:calc(var(--fs-h3) * var(--type-scale, 1));line-height:var(--lh-h3);
  letter-spacing:var(--ls-h3)}
.tl-year-tag .tl-dot{background:var(--c-accent)}
.tl-dot{flex:0 0 auto;width:8px;height:8px;border-radius:50%;background:var(--c-meta)}
.empty{color:var(--c-meta)}
.pager{display:flex;justify-content:space-between;align-items:center;gap:1rem;
  border-top:1px solid var(--c-rule);padding-top:1rem;margin-top:1rem;font-size:var(--fs-small)}
.pager-count{color:var(--c-meta)}
form.search{display:flex;gap:.5rem;margin:0 0 2rem}
form.search input{flex:1;padding:.5rem .75rem;border:1px solid var(--c-rule);border-radius:.35rem;
  background:var(--c-bg);color:var(--c-text);font:inherit}
form.search button{padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:.35rem;
  background:var(--c-bg);color:var(--c-heading);font:inherit;cursor:pointer}
nav.series{border-top:1px solid var(--c-rule);margin-top:2.5rem;padding-top:1rem;font-size:var(--fs-small)}
nav.series ol{margin:.5rem 0 0;padding-left:1.25rem}
nav.series li[aria-current]{color:var(--c-meta)}
p.tags{margin-top:1.5rem;font-size:var(--fs-small);color:var(--c-meta)}

figure{margin:2rem 0}
figure img{display:block;margin:0 auto;border-radius:.25rem}
figcaption{color:var(--c-meta);font-size:var(--fs-caption);text-align:center;margin-top:.5rem}
.img-left img{margin-left:0}
.img-right img{margin-right:0}
.img-wide{margin-left:calc(-1 * clamp(0px,4vw,4rem));margin-right:calc(-1 * clamp(0px,4vw,4rem))}
.gallery{display:grid;gap:.5rem;margin:2rem 0}
.gallery figure{margin:0}
.gallery-cols-2{grid-template-columns:repeat(2,1fr)}
.gallery-cols-3{grid-template-columns:repeat(3,1fr)}
.gallery-cols-4{grid-template-columns:repeat(4,1fr)}

.video-embed,.video-file{margin:2rem 0}
.video-embed{position:relative;padding-top:56.25%}
.video-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.video-file video{width:100%;display:block}
.audio-embed iframe{width:100%;height:9.25rem;border:0}

.callout{border-left:2px solid var(--c-accent);padding:.75rem 0 .75rem 1rem;margin:1.75rem 0}
.callout-label{font-weight:600;color:var(--c-heading);margin:0 0 .35rem}
.callout p:last-child{margin-bottom:0}

/* applyFootnotes already emits an <hr class="fn-rule">; a border-top here as well
   drew TWO lines above the notes. Caught by opening the page, not by reading it. */
.prose .fn-rule{margin-top:2.5em}
.footnotes{font-size:var(--fs-small);color:var(--c-meta)}
.footnotes ol{padding-left:1.25rem}
sup.fnref a{text-decoration:none}

footer.site{padding:3rem 0;text-align:center;color:var(--c-meta);font-size:var(--fs-small)}
.footer-text{margin:0}
footer.site a{text-decoration:underline;text-underline-offset:2px}
footer.site a:hover{color:var(--c-text)}

/* Shiki emits a light colour inline and a --shiki-dark var; the dark palette swaps them. */
.dark .shiki,.dark .shiki span{color:var(--shiki-dark)!important;background-color:var(--shiki-dark-bg)!important}

/* THE RAIL: the listing sidebar and the post's table of contents, which are one piece of
   furniture wearing two sets of contents. All server-rendered, so these rules apply with
   or without JavaScript; only the aria-current highlight and the mobile drawer come from
   the bundle.

   BELOW the rail breakpoint it sits above the article, in normal flow, exactly as written
   here. ABOVE it, the rules generated by singleRailCss move it into the left gutter. The
   frozen tree also had a slide-out drawer and a toggle island for narrow screens; a list
   that simply sits above the article needs neither, so that island is not ported. */
:root{--rail-w:250px;--rail-gap:40px;
  /* Gap between a rail row's text and the accent marker beside it. */
  --rail-pad:14px;
  /* Space between the header and the first line of content. The rail's top matches it, so
     the rail's first line is level with the article's first line. */
  --rail-top:3rem}

/* Mobile FIRST: the rail is a slide-out drawer opened from the header menu button. The
   injected geometry promotes it into the gutter above the breakpoint. ONE piece of DOM
   serves both, which is why there is no second copy of the sidebar to keep in step. */
.rail{position:fixed;top:0;bottom:0;left:0;z-index:40;width:min(300px,84vw);
  overflow-y:auto;overscroll-behavior:contain;padding:4.5rem 1.25rem 2rem;
  background:var(--c-bg);border-right:1px solid var(--c-rule);
  transform:translateX(-100%);transition:transform .25s ease}
html[data-rail=open] .rail{transform:none}
/* Two-rail listings only: on mobile there is no gutter, so the LEFT rail is hidden and its
   blocks appear in the right rail's drawer through .drawer-only. */
.rail-left{display:none}
/* Tap anywhere else to close. No dim: the drawer already owns a solid surface. */
.rail-scrim{position:fixed;inset:0;z-index:39}
.rail-inner{position:sticky;top:2.5rem}
.rail-inner > * + *,.drawer-only > * + *{margin-top:1.75rem}
.rail h2{margin:0 0 .75rem;padding-left:var(--rail-pad);font-weight:600;color:var(--c-heading);
  font-size:calc(var(--fs-small) * var(--type-scale, 1));line-height:var(--lh-small);
  letter-spacing:var(--ls-small)}
.rail ul{list-style:none;margin:0;padding:0}
.rail li{margin-top:.5rem}
.rail li:first-child{margin-top:0}
.rail-row{position:relative;display:flex;justify-content:space-between;gap:.875rem;
  padding-left:var(--rail-pad);color:var(--c-meta)}
.rail-row:hover,.rail-tags a:hover{color:var(--c-heading)}
/* The one accent mark: a hairline beside the row you are already reading. In the drawer it
   sits left of the text; in the gutter the rail flips and it faces the divider. */
.rail-row[aria-current]::before{content:"";position:absolute;left:0;top:3px;bottom:3px;
  width:2px;background:var(--c-accent)}
/* Counts sit in their own right-aligned column so the labels stay aligned however many
   digits a count carries. The column is exactly as wide as the widest count on the page
   (--count-w, in ch, exact because the digits are tabular); a fixed em width would leave
   dead space on every single-digit row. */
.rail-count{min-width:var(--count-w,1ch);text-align:right;flex-shrink:0;
  font-variant-numeric:tabular-nums}
.rail-tags{display:flex;flex-wrap:wrap;column-gap:.75rem;row-gap:.25rem;padding-left:var(--rail-pad)}
.rail-tags a{color:var(--c-meta)}
/* Tags are many and short: a wrapped run of plain words, no chips, no boxes. */
.rail-tags.lower a{text-transform:lowercase}
.term-count{margin-left:.25rem;opacity:.6;font-variant-numeric:tabular-nums}
.rail-row.is-active,.rail-tags a.is-active{font-weight:500;color:var(--c-heading)}
.rail-tags a.is-active{text-decoration:underline;text-decoration-color:var(--c-accent);
  text-underline-offset:4px}
/* No panel: no border, no shadow, no background, just type sitting on the page. It had a
   left border and a padded box, which read as a widget parked beside the article.

   Nest visually ONLY when the post MIXES levels: an H2 row carries one bigger dot as a
   section marker and an H3 row simply goes smaller. So it reads as a few strong markers
   over quieter children rather than a column of identical bullets. The dot is an inline
   ::before, so it flows for BOTH rail orientations with no per-side handling. */
.rail-lead::before{content:"•";font-size:.72em;margin-inline-end:.5em;vertical-align:.12em;
  color:var(--c-meta)}
.rail-sub{font-size:calc(var(--fs-caption) * var(--type-scale, 1))}
.toc-end{margin-top:1rem}
/* Below the rail breakpoint the ToC is the drawer, and a post with a long index needs the
   whole column: the listing rail is not on this page to share it with. */
.toc li{margin-top:.5rem}
`.trim()

/** The document sheet plus the island sheet, in that order, inlined as one <style>. */
export const PUBLIC_CSS = `${BASE_CSS}
${ISLANDS_CSS}`
