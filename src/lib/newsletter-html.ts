// A minimal self-contained HTML page for the newsletter confirm / unsubscribe links
// (they open in the reader's browser from an email, so they can't be a React route
// that assumes the app shell). Server-only; text is pre-escaped by the caller's i18n.

export function resultPage(title: string, body: string, homeUrl: string, homeLabel: string): Response {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${esc(title)}</title>
<style>
  :root { color-scheme: light dark }
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; max-width: 32rem;
         margin: 12vh auto; padding: 0 1.25rem; line-height: 1.6; color: #1a1a1a; background: #fff }
  @media (prefers-color-scheme: dark) { body { color: #e5e5e5; background: #111 } }
  h1 { font-size: 1.4rem; margin: 0 0 .5rem } p { color: #666 } a { color: inherit }
  @media (prefers-color-scheme: dark) { p { color: #aaa } }
</style></head><body>
<h1>${esc(title)}</h1>
${body ? `<p>${esc(body)}</p>` : ''}
<p><a href="${esc(homeUrl)}">${esc(homeLabel)} →</a></p>
</body></html>`
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })
}
