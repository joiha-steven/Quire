// The IDE chrome (settings.ideChrome). Split out of `islands.css.ts` at the 400-line
// limit, and the seam is a real one: every rule here is behind ONE attribute and none of
// it applies unless the owner turned the switch on.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that — and this file is IN its list, which is the mistake
// `prose.css.ts` made by being split out without being added.

export const IDE_CSS = `
/* --- IDE CHROME (settings.ideChrome, html[data-ide-chrome=on]) -------------------
   One deliberate contrast: the reading column stays analogue - a book serif, ranged
   left, no ornament - and everything AROUND it reads as source code. The two halves
   are supposed to disagree; that disagreement is the design.

   Every rule below is additive and lives behind one attribute, so turning the switch
   off in Admin leaves not a trace of it. Nothing here touches .prose, the post title,
   the card excerpts or the comment bodies: those are the reader's own words and they
   are the half that must NOT look technical.

   Colour comes from theme tokens only, as everywhere else. The two roles a code
   editor actually distinguishes are the comment and the literal, so that is what is
   borrowed: labels are comments (--c-meta), counts and dates are literals
   (--c-accent). No third colour, and no hex. */

/* Labels are comments. The marker is CSS, not markup, so the heading a screen reader
   and a feed see stays the plain word. */
html[data-ide-chrome=on] .rail h2::before{content:"// ";color:var(--c-meta)}

/* Counts are literals, bracketed like an index. --c-accent is the one accent token,
   already held to AA against its own background by the palette tests. */
html[data-ide-chrome=on] .rail-count{color:var(--c-accent)}
html[data-ide-chrome=on] .rail-count::before{content:"["}
html[data-ide-chrome=on] .rail-count::after{content:"]"}
html[data-ide-chrome=on] .term-count{color:var(--c-accent);opacity:1}
/* The date and the reading time are literals too; the words between them are not. */
html[data-ide-chrome=on] .t-small time{color:var(--c-accent)}

/* THE GUTTER. A counter on the list, ranged right in its own column, exactly as an
   editor numbers lines. It is decoration, so it is aria-hidden by being generated
   content on the <li> rather than inside the link - the row's accessible name is
   still the label and its count.

   It is --c-meta and not the hairline token, which measured 1.16:1 against the page:
   invisible, and a generated counter is still announced by some screen readers. A real
   editor's gutter is perfectly legible; what makes it a gutter is where it sits and
   that its figures are tabular, not that you cannot read it.

   The column is in ch of the mono chrome, so two digits always fit and the labels
   stay aligned however long the list runs. Tabular figures are what stop the numbers
   shifting the labels as the count crosses 9. */
/* The rail RANGES LEFT in here, and that is not a side effect. In the gutter layout it
   ranges right, so its text hugs the article - which is correct typography and exactly
   wrong for a gutter: the numbers would sit at a fixed left edge with a ragged gap
   between them and the rows they count. Code ranges left. Under this switch, so does
   the rail, and the gutter lands where an editor puts it. */
html[data-ide-chrome=on] .rail{text-align:left}
/* The gutter layout packs the row to flex-end, which is what actually ranges it right;
   text-align alone does nothing to a flex item. Left for the label, right for the
   count, which is where an editor puts a line's annotation. */
html[data-ide-chrome=on] .rail-row{justify-content:space-between}
html[data-ide-chrome=on] .rail ul{counter-reset:ln}
html[data-ide-chrome=on] .rail li{counter-increment:ln;position:relative;
  padding-left:3ch}
html[data-ide-chrome=on] .rail li::before{content:counter(ln);position:absolute;
  left:0;width:2ch;text-align:right;color:var(--c-meta);
  font-variant-numeric:tabular-nums;pointer-events:none}
/* The active marker faces the text rather than the divider, since the text moved. */
html[data-ide-chrome=on] .rail-row[aria-current]::before{left:auto;right:0}
/* The tag cloud is a run of words, not a list, so it has no lines to number. */
html[data-ide-chrome=on] .rail-tags{counter-reset:none}
`.trim()
