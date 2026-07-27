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

/* --- islands -------------------------------------------------------------------
   Every rule below styles an element the browser bundle CREATES. None of it applies
   to the server-rendered page, so a reader with JavaScript off sees no gaps: the
   elements simply never exist. */

.code-copy{position:absolute;top:.4rem;right:.4rem;padding:.15rem .5rem;font-size:.75rem;
  border:1px solid var(--c-rule);background:var(--c-bg);color:var(--c-meta);cursor:pointer;opacity:0;transition:opacity .15s}
.prose pre{position:relative}
.prose pre:hover .code-copy,.code-copy:focus-visible{opacity:1}

/* The reading-progress bar has NO script behind it: a scroll-driven animation reads the
   document's own scroll position. It therefore works with JavaScript off, and runs off the
   main thread. On an engine without scroll timelines the bar would sit at zero forever, so
   the @supports rule removes it entirely rather than leaving a dead hairline on the page.
   NOTE: no backticks anywhere in this file. It is one template literal, and a backtick in
   a comment ends the string. That has now cost two debugging sessions. */
.progress{display:none;position:fixed;inset-inline:0;top:0;height:2px;z-index:50}
.progress-fill{height:100%;background:var(--c-heading);transform:scaleX(0);transform-origin:0 50%}
@supports (animation-timeline:scroll()){
  .progress{display:block}
  .progress-fill{animation:read-progress linear both;animation-timeline:scroll(root block)}
}
@keyframes read-progress{to{transform:scaleX(1)}}

.to-top{position:fixed;bottom:1.25rem;right:1.25rem;z-index:40;display:flex;width:2.5rem;height:2.5rem;
  align-items:center;justify-content:center;border:1px solid var(--c-rule);border-radius:999px;
  background:var(--c-bg);color:var(--c-meta);cursor:pointer;opacity:0;pointer-events:none;transition:opacity .2s,color .2s}
.to-top.shown{opacity:1;pointer-events:auto}
.to-top:hover{color:var(--c-heading)}

/* A <dialog>, so Escape, focus trapping and the inert background come from the browser.
   The viewer is deliberately NOT themed: a light backdrop behind a photograph is a worse
   reading of the photograph, and readers expect a lightbox to be dark. */
.lightbox[open]{display:flex}
.lightbox{width:100%;max-width:100%;height:100%;max-height:100%;border:0;overflow:hidden;
  flex-direction:column;align-items:center;justify-content:center;gap:.75rem;padding:1rem;
  background:rgba(0,0,0,.9);color:#fff}
.lightbox::backdrop{background:rgba(0,0,0,.9)}
.lightbox-caption:empty{display:none}
.lightbox-img{max-height:85vh;max-width:100%;object-fit:contain}
.lightbox-caption{max-width:42rem;text-align:center;font-size:.875rem;color:rgba(255,255,255,.7);margin:0}
.lightbox button{position:absolute;display:flex;align-items:center;justify-content:center;
  border:0;border-radius:999px;background:transparent;color:rgba(255,255,255,.8);cursor:pointer;line-height:1}
.lightbox button:hover{background:rgba(255,255,255,.1);color:#fff}
.lightbox-close{top:.75rem;right:.75rem;width:2.5rem;height:2.5rem;font-size:1.5rem}
.lightbox-prev,.lightbox-next{top:50%;transform:translateY(-50%);width:3rem;height:3rem;font-size:1.875rem}
.lightbox-prev{left:.5rem}
.lightbox-next{right:.5rem}
.lightbox-count{position:absolute;bottom:1rem;font-size:.75rem;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.6)}

.preview-note{border:1px solid var(--c-rule);background:var(--c-rule);color:var(--c-meta);
  border-radius:.5rem;padding:.5rem 1rem;font-size:var(--fs-small);margin:0 0 1.5rem}

/* Comments and sign-up. The FORM is server-rendered markup, so these rules apply with or
   without JavaScript; the comment thread is built by the island, so its rules only ever
   match once the script has run. */
form.subscribe{border-top:1px solid var(--c-rule);margin-top:3rem;padding-top:1.5rem;font-size:var(--fs-small)}
form.subscribe label{display:block;color:var(--c-heading);font-weight:600;margin-bottom:.5rem}
.subscribe-row{display:flex;gap:.5rem}
.subscribe-row input{flex:1;padding:.5rem .75rem;border:1px solid var(--c-rule);border-radius:.35rem;
  background:var(--c-bg);color:var(--c-text);font:inherit}
.subscribe-row button{padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:.35rem;
  background:var(--c-bg);color:var(--c-heading);font:inherit;cursor:pointer}
.subscribe-status:empty{display:none}
.subscribe-status{color:var(--c-meta);margin:.5rem 0 0}

#comments{border-top:1px solid var(--c-rule);margin-top:3rem;padding-top:1.5rem}
#comments h2{font-size:var(--fs-h2);color:var(--c-heading);font-weight:600;margin:0 0 1.5rem}
.comment-list,.comment-replies{list-style:none;padding:0;margin:0}
.comment-replies{margin-left:1.25rem;padding-left:1rem;border-left:1px solid var(--c-rule)}
.comment{margin:0 0 1.5rem}
.comment-meta{color:var(--c-meta);font-size:var(--fs-small);margin:0 0 .35rem}
.comment-name{color:var(--c-heading);font-weight:600}
.comment-body p:last-child{margin-bottom:0}
.comment-reply{border:0;background:none;padding:0;margin-top:.35rem;color:var(--c-meta);
  font:inherit;font-size:var(--fs-small);cursor:pointer;text-decoration:underline}
.comment-reply:hover{color:var(--c-heading)}
.comment-form{margin-top:1.5rem;font-size:var(--fs-small)}
.comment-field{margin:0 0 .75rem}
.comment-field label{display:block;color:var(--c-meta);margin-bottom:.25rem}
.comment-form input,.comment-form textarea{width:100%;padding:.5rem .75rem;border:1px solid var(--c-rule);
  border-radius:.35rem;background:var(--c-bg);color:var(--c-text);font:inherit}
.comment-form button{margin-top:.75rem;padding:.5rem 1rem;border:1px solid var(--c-rule);border-radius:.35rem;
  background:var(--c-bg);color:var(--c-heading);font:inherit;cursor:pointer}
.comment-status:empty{display:none}
.comment-status{color:var(--c-meta);margin:.5rem 0 0}

@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`.trim()
