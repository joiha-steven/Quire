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
   (--c-text). No third colour, and no hex.

   The literal was --c-accent for one deploy. This blog's Mono accent is red, so every
   date and count read as a link that was not one. --c-text is the ink the article is
   already set in: a clear step darker than the label, and silent. */

/* Labels are comments. The marker is CSS, not markup, so the heading a screen reader
   and a feed see stays the plain word. */
html[data-ide-chrome=on] .rail h2::before{content:"// ";color:var(--c-meta)}

/* Counts are literals, bracketed like an index. */
html[data-ide-chrome=on] .rail-count{color:var(--c-text)}
html[data-ide-chrome=on] .rail-count::before{content:"["}
html[data-ide-chrome=on] .rail-count::after{content:"]"}
html[data-ide-chrome=on] .term-count{color:var(--c-text);opacity:1}
/* The date and the reading time are literals too; the words between them are not. */
html[data-ide-chrome=on] .t-small time{color:var(--c-text)}

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
/* The rail keeps the alignment it has with the switch off: ranged right, hugging the
   article. An earlier pass ranged it LEFT to put the gutter where an editor puts it;
   the owner asked for the opposite, so the GUTTER moves to the far right instead and
   nothing else about the rail changes. The active marker stays where the gutter layout
   put it, at the row's right edge, which is now 3.5ch clear of the numbers. */
html[data-ide-chrome=on] .rail ul{counter-reset:ln}
html[data-ide-chrome=on] .rail li{counter-increment:ln;position:relative;
  padding-right:3.5ch}
/* The SIZE is stated, and it has to be. The counter hangs off the <li>, which sits
   OUTSIDE .rail-row and its .t-small - so it inherited the BODY size and the gutter came
   out larger than the labels it counts. Caption is the role for a figure's label, which
   is what a line number is. */
html[data-ide-chrome=on] .rail li::before{content:counter(ln);position:absolute;
  right:0;width:2ch;text-align:right;color:var(--c-meta);
  font-size:var(--fs-caption);line-height:var(--lh-caption);
  letter-spacing:var(--ls-caption);
  font-variant-numeric:tabular-nums;pointer-events:none}
/* The tag cloud is a run of words, not a list, so it has no lines to number. */
html[data-ide-chrome=on] .rail-tags{counter-reset:none}
`.trim()
