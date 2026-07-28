// The article body's typography, shared by the public sheet and the admin editor.
//
// The frozen tree kept these in `globals.css`, which the admin layout loaded on top of. 2.0
// has no globals.css, and the editor is a `.prose` surface: without these rules the writing
// surface loses its rhythm entirely and every paragraph runs into the next. That is what it
// did, and it is why this is a shared constant rather than a copy in each sheet — two
// copies of a type scale stay in step for about a month.
//
// NO BACKTICKS anywhere below: this is one template literal and a backtick ends it.
// `check:css-literal` enforces that.

export const PROSE_CSS = `
/* The body's rhythm is ONE rule: every sibling gets the same lead, and the headings then
   buy themselves a little more. Margins were bottom-side and fixed in rem here, which does
   not scale with the reader's type size and left headings floating between paragraphs. */
/* The reading face belongs HERE, not in the public sheet, because the editor is a .prose
   surface too and what you type has to be set in the face it will be published in. It lived
   in public.css.ts, so the writing surface fell back to the chrome font and a post drafted
   in JetBrains Mono was published in Literata. */
.prose{font-family:var(--font-reading);
  font-size:var(--fs-body);line-height:var(--lh-body);
  letter-spacing:var(--ls-body);color:var(--c-text)}
.prose > * + *{margin-top:1.4em}
.prose h1,.prose h2,.prose h3,.prose h4,.prose h5{color:var(--c-heading);font-weight:600;
  scroll-margin-top:2rem}
.prose h1{font-size:var(--fs-h1);line-height:var(--lh-h1);
  letter-spacing:var(--ls-h1);margin-top:1.9em}
.prose h2{font-size:var(--fs-h2);line-height:var(--lh-h2);
  letter-spacing:var(--ls-h2);margin-top:1.85em;margin-bottom:-.15em}
.prose h3{font-size:var(--fs-h3);line-height:var(--lh-h3);
  letter-spacing:var(--ls-h3);margin-top:1.6em}
.prose h4{font-size:var(--fs-h4);line-height:var(--lh-h4);
  letter-spacing:var(--ls-h4);margin-top:1.5em}
.prose h5{font-size:var(--fs-h5);line-height:var(--lh-h5);
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
.prose code{font-family:inherit;font-size:var(--fs-code)}
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
`.trim()
