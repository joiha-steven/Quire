// The site header and footer: the parts of the page that are the same everywhere.
//
// Both were duplicated across `article.ts` and the listing renderer, and the two copies had
// already started to differ (the listing had a tagline, the article did not). One function
// each, called from both.
//
// Every control here works WITHOUT JavaScript. The search trigger is a link to `/search`;
// the subscribe trigger is a link to the sign-up card at the foot of an article. The
// islands intercept them and open an overlay instead, which is faster but never
// load-bearing.

import type { SiteSettings } from '@/types'
import { t } from '@/i18n/i18n'
import { renderInlineMarkdown, expandFooterTokens } from '@/render/inline-md'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

/**
 * Inline SVG rather than an icon font: no extra request, and it inherits `currentColor`.
 * All 20px, because they are sibling controls on one row and a mixed set reads as a
 * mistake — the frozen tree kept them in step with a shared class string.
 */
const svg = (body: string, width = '1.6') =>
  `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"`
  + ` stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">`
  + `${body}</svg>`

const ICON = {
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>', '1.7'),
  grid: svg('<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/>'
    + '<rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/>'),
  mail: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>', '1.7'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4'
    + 'M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  menu: svg('<path d="M5 8h14M8 16h11"/>'),
}

export type ChromeOptions = {
  /** The sign-up form only appears when the owner has a working mail server. */
  mailConfigured: boolean
}

/**
 * The site name, as the owner's logo when there is one and as words when there is not.
 *
 * A plain `<img>` with width and height on it: the attributes reserve the space so the
 * header does not jump when it arrives, and `logoRenderUrl` is the display-sized WebP the
 * admin builds on save — the original is only served when there is no render (a vector or
 * an animated logo).
 */
function siteTitle(settings: SiteSettings): string {
  const src = settings.showLogo && settings.logoUrl
    ? (settings.logoRenderUrl || settings.logoUrl)
    : ''
  const inner = src
    ? `<img class="logo" src="${escapeAttr(src)}" alt="${escapeAttr(settings.title)}"
 width="${settings.logoWidth}"${settings.logoRenderHeight ? ` height="${settings.logoRenderHeight}"` : ''}
 style="width:${settings.logoWidth}px" fetchpriority="high" decoding="async">`
    : escapeHtml(settings.title)
  return `<a class="title" href="/">${inner}</a>`
}

export function siteHeader(settings: SiteSettings, opts: ChromeOptions): string {
  const s = t(settings.language)
  const actions: string[] = []

  if (settings.features.search) {
    // A LINK, not a button. Without JavaScript it goes to the search page, which renders
    // the same results server-side. The island turns it into an overlay.
    actions.push(`<a class="icon-btn" href="/search" data-search-open
 aria-label="${escapeAttr(s.search)}" title="${escapeAttr(s.search)}">${ICON.search}</a>`)
  }
  // The sun is what the server can honestly draw: the reader's mode lives in their own
  // storage, and the page cache is keyed by URL alone (Invariant 1), so a server-rendered
  // moon would be wrong for everyone who did not choose dark. The island swaps it on load.
  actions.push(`<button type="button" class="icon-btn" data-theme-toggle
 aria-label="${escapeAttr(s.theme)}" title="${escapeAttr(s.theme)}">${ICON.sun}</button>`)
  if (settings.features.gridView) {
    // A BUTTON, not a link: there is no server-side URL for "the same list as a grid", and
    // inventing one would be a second URL for the same content. It hides itself on a page
    // that has no list.
    actions.push(`<button type="button" class="icon-btn" data-grid-toggle
 aria-pressed="false" aria-label="${escapeAttr(s.gridView)}">${ICON.grid}</button>`)
  }
  if (opts.mailConfigured) {
    // Points at the sign-up card at the foot of an article, so it does something on a
    // page with no script. The island opens it as an overlay instead.
    actions.push(`<a class="icon-btn" href="#subscribe" data-subscribe-open
 aria-label="${escapeAttr(s.nlHeading)}" title="${escapeAttr(s.nlHeading)}">${ICON.mail}</a>`)
  }
  // Opens the sidebar drawer, and stays the rightmost control. Above the rail breakpoint
  // the injected geometry hides it, because the sidebar is then the gutter rail; on a page
  // that rendered no rail the island hides it, because it would open nothing.
  actions.push(`<button type="button" class="icon-btn rail-toggle" data-rail-toggle
 aria-expanded="false" aria-label="${escapeAttr(s.menu)}">${ICON.menu}</button>`)

  return `<header class="site">
<div class="site-bar">${siteTitle(settings)}<nav class="site-actions">${actions.join('')}</nav></div>${
    settings.showDescription && settings.description
      ? `<p class="tagline">${escapeHtml(settings.description)}</p>` : ''
  }</header>`
}

/** The footer: the owner's own line, centred, and nothing else. */
export function siteFooter(settings: SiteSettings, opts: ChromeOptions): string {
  // Owner text, centred, and nothing else. The sign-up form used to live here so the
  // header's mail link always had an anchor to land on; the frozen tree puts that form at
  // the end of an ARTICLE, and a form in the footer of every listing is a different site.
  void opts
  // Limited inline markdown with {year} and {title} tokens, exactly as the frozen tree
  // rendered it. `renderInlineMarkdown` is the sanitiser, so this is not raw owner HTML.
  const footerText = settings.footer
    ? `<p class="footer-text">${renderInlineMarkdown(expandFooterTokens(settings.footer, settings.title))}</p>`
    : ''
  return `<footer class="site">${footerText}</footer>`
}

/**
 * The newsletter sign-up card, at the end of an article.
 *
 * A real form with a method and an action: `/api/subscribe` answers a form post with a
 * page, so it works with JavaScript off. The island upgrades it to an inline status.
 */
export function subscribeCard(settings: SiteSettings): string {
  const s = t(settings.language)
  return `<section class="subscribe-card" id="subscribe">
<h2>${escapeHtml(s.nlHeading)}</h2>
<form class="subscribe" method="post" action="/api/subscribe">
<input type="email" name="email" required aria-label="${escapeAttr(s.nlPlaceholder)}"
 placeholder="${escapeAttr(s.nlPlaceholder)}"><button type="submit">${escapeHtml(s.nlButton)}</button>
</form>
<p class="subscribe-status" role="status"></p>
</section>`
}

/**
 * The strings the chrome islands show a reader, as `data-` attributes on `<body>`.
 *
 * Shared by every public page, because the header is. The article page adds its own on top
 * of these rather than repeating them.
 */
export function chromeLabels(settings: SiteSettings): Record<string, string> {
  const s = t(settings.language)
  return {
    search: s.search,
    searchHint: s.searchHint,
    searchEmpty: s.searchEmpty,
    lightboxClose: s.lightboxClose,
    gridView: s.gridView,
    listView: s.listView,
    theme: s.theme,
    themeLight: s.themeLight,
    themeDark: s.themeDark,
    themeSystem: s.themeSystem,
    themeTime: s.themeTime,
    nlSuccess: s.nlSuccess,
    nlNoMail: s.nlNoMail,
    nlInvalid: s.nlInvalid,
    nlError: s.nlError,
    // The header's sign-up overlay builds its own form, because the in-page card only
    // exists at the foot of an ARTICLE and the button is in the header of every page.
    nlHeading: s.nlHeading,
    nlPlaceholder: s.nlPlaceholder,
    nlButton: s.nlButton,
  }
}
