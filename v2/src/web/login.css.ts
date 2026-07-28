// Styles for the sign-in screens, appended after the public sheet.
//
// Theme tokens only, exactly like the public sheet: the sign-in page has to look like the
// blog it belongs to, and it does that by drawing from the same palette rather than by
// having its own that someone keeps in step by hand.
//
// NO BACKTICKS BELOW. This is one template literal, so a backtick inside it ends the
// string. It has cost two failed boots in this repository already; check:css guards both
// this file and public.css.ts.

export const LOGIN_CSS = `
.login-wrap{min-height:100dvh;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:1.5rem;padding:2rem 1rem}
.login-brand{display:flex;align-items:center;gap:.6rem;font-family:var(--font-sans);
  font-size:var(--fs-h3);color:var(--c-heading);text-decoration:none}
.login-brand img{border-radius:4px}
.login-card{width:100%;max-width:23rem;border:1px solid var(--c-rule);border-radius:8px;
  padding:1.75rem;background:var(--c-bg)}
.login-card h1{font-size:var(--fs-h2);line-height:var(--lh-h2);margin:0 0 .25rem}
.login-card h2{font-size:var(--fs-body);line-height:var(--lh-body);margin:1.25rem 0 .25rem}
.login-step{font-size:var(--fs-caption);color:var(--c-meta);margin:0 0 1rem}
.login-hint{font-size:var(--fs-small);color:var(--c-meta);margin:0 0 1rem}
.login-form{display:flex;flex-direction:column;gap:.35rem}
.login-form label{font-size:var(--fs-small);color:var(--c-meta);margin-top:.75rem}
.login-form input[type=text],.login-form input[type=password]{
  width:100%;box-sizing:border-box;padding:.6rem .7rem;font:inherit;font-size:var(--fs-body);
  color:var(--c-text);background:var(--c-bg);border:1px solid var(--c-rule);border-radius:5px}
.login-form input:focus-visible{outline:2px solid var(--c-accent);outline-offset:1px}
.login-reveal{position:relative;display:flex}
/* Padding on the input, not a wrapper, so the toggle never sits over typed text. */
.login-reveal input{padding-right:2.5rem}
.login-reveal button{position:absolute;right:.25rem;top:50%;transform:translateY(-50%);
  border:0;background:none;cursor:pointer;padding:.4rem;line-height:1;color:var(--c-meta)}
.login-caps{font-size:var(--fs-caption);color:var(--c-accent);margin:.4rem 0 0}
.login-submit{margin-top:1.25rem;padding:.65rem 1rem;font:inherit;font-size:var(--fs-body);
  color:var(--c-bg);background:var(--c-accent);border:0;border-radius:5px;cursor:pointer}
.login-error{font-size:var(--fs-small);color:var(--c-accent);border:1px solid var(--c-accent);
  border-radius:5px;padding:.6rem .7rem;margin:0 0 1rem}
.login-alt{margin:1.25rem 0 0;font-size:var(--fs-small);text-align:center}
.login-alt a{color:var(--c-link)}
.login-secret{margin:0 0 1rem;text-align:center}
.login-secret code{font-size:var(--fs-code);letter-spacing:.08em;word-break:break-all}
.login-qr{display:flex;justify-content:center;margin:0 0 1rem}
.login-qr svg{width:11rem;height:11rem}
.login-codes{display:grid;grid-template-columns:repeat(2,1fr);gap:.35rem 1rem;
  margin:0 0 1rem;padding:0 0 0 1.25rem}
.login-codes code{font-size:var(--fs-code)}
.login-check{display:flex;align-items:flex-start;gap:.5rem;margin-top:1rem;
  font-size:var(--fs-small);color:var(--c-text)}
.login-check input{margin-top:.15rem}
`
