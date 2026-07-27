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

export const PUBLIC_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{
  margin:0;background:var(--c-bg);color:var(--c-text);
  font-family:var(--font-reading);font-size:var(--fs-body);line-height:var(--lh-body);
  letter-spacing:var(--ls-body);
}
img,video,iframe{max-width:100%;height:auto}
a{color:var(--c-link);text-decoration:underline;text-underline-offset:.15em}
a:hover{color:var(--c-heading)}
hr{border:0;border-top:1px solid var(--c-rule);margin:2.5rem 0}

.wrap{max-width:var(--content-width,42rem);margin:0 auto;padding:0 1.25rem}

header.site{padding:2.5rem 0 1.5rem}
header.site .title{font-family:var(--font-chrome);font-weight:600;color:var(--c-heading);text-decoration:none}
header.site .tagline{color:var(--c-meta);font-size:var(--fs-small);margin:.35rem 0 0}

article h1{
  font-size:var(--fs-h1);line-height:var(--lh-h1);letter-spacing:var(--ls-h1);
  color:var(--c-heading);margin:0 0 .5rem;font-weight:600;
}
article .meta{color:var(--c-meta);font-size:var(--fs-small);margin:0 0 2rem}
article .meta a{color:inherit}

.prose h2{font-size:var(--fs-h2);line-height:var(--lh-h2);letter-spacing:var(--ls-h2)}
.prose h3{font-size:var(--fs-h3);line-height:var(--lh-h3);letter-spacing:var(--ls-h3)}
.prose h2,.prose h3,.prose h4,.prose h5,.prose h6{color:var(--c-heading);font-weight:600;margin:2.25rem 0 .75rem}
.prose p,.prose ul,.prose ol,.prose blockquote,.prose table{margin:0 0 1.25rem}
.prose li{margin:.25rem 0}
.prose blockquote{border-left:2px solid var(--c-rule);margin-left:0;padding-left:1rem;color:var(--c-meta)}
.prose code{font-size:var(--fs-code);font-family:var(--font-mono,ui-monospace,monospace)}
.prose pre{padding:1rem;border-radius:.5rem;overflow-x:auto;font-size:var(--fs-code)}
.prose pre code{font-size:inherit}
.prose table{border-collapse:collapse;width:100%}
.prose th,.prose td{border:1px solid var(--c-rule);padding:.4rem .6rem;text-align:left}

.listing-head h1{font-size:var(--fs-h1);color:var(--c-heading);margin:0 0 .25rem;font-weight:600}
.listing-head{margin:0 0 2rem}
.card{padding:0 0 1.75rem;margin:0 0 1.75rem;border-bottom:1px solid var(--c-rule)}
.card:last-child{border-bottom:0}
.card h2{font-size:var(--fs-h2);line-height:var(--lh-h2);margin:0 0 .35rem;font-weight:600}
.card h2 a{color:var(--c-heading);text-decoration:none}
.card h2 a:hover{color:var(--c-link)}
.card .meta{color:var(--c-meta);font-size:var(--fs-small);margin:0 0 .5rem}
.card .meta a{color:inherit}
.card .excerpt{margin:0;color:var(--c-text)}
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

footer.site{border-top:1px solid var(--c-rule);margin-top:4rem;padding:1.5rem 0 3rem;color:var(--c-meta);font-size:var(--fs-small)}

/* Shiki emits a light colour inline and a --shiki-dark var; the dark palette swaps them. */
.dark .shiki,.dark .shiki span{color:var(--shiki-dark)!important;background-color:var(--shiki-dark-bg)!important}

@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`.trim()
