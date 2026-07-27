// The site header and footer: the parts of the page that are the same everywhere.
//
// Both were duplicated across `article.ts` and the listing renderer, and the two copies had
// already started to differ (the listing had a tagline, the article did not). One function
// each, called from both.
//
// Every control here works WITHOUT JavaScript. The search trigger is a link to `/search`;
// the subscribe trigger is a link to the sign-up form in the footer. The islands intercept
// them and open an overlay instead, which is faster but never load-bearing.

import type { SiteSettings } from '@/types'
import { t } from '@/i18n/i18n'
import { renderInlineMarkdown, expandFooterTokens } from '@/render/inline-md'

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

/** Inline SVG rather than an icon font: no extra request, and it inherits `currentColor`. */
const ICON = {
  search: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" aria-hidden="true">'
    + '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/>'
    + '<rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  mail: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
    + ' stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
    + '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
}

export type ChromeOptions = {
  /** The sign-up form only appears when the owner has a working mail server. */
  mailConfigured: boolean
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
  if (settings.features.gridView) {
    // A BUTTON, not a link: there is no server-side URL for "the same list as a grid", and
    // inventing one would be a second URL for the same content. It hides itself on a page
    // that has no list.
    actions.push(`<button type="button" class="icon-btn" data-grid-toggle
 aria-pressed="false" aria-label="${escapeAttr(s.gridView)}">${ICON.grid}</button>`)
  }
  if (opts.mailConfigured) {
    // Points at the footer form, so it does something on a page with no script.
    actions.push(`<a class="icon-btn" href="#subscribe" data-subscribe-open
 aria-label="${escapeAttr(s.nlHeading)}" title="${escapeAttr(s.nlHeading)}">${ICON.mail}</a>`)
  }

  return `<header class="site">
<div class="site-bar"><a class="title" href="/">${escapeHtml(settings.title)}</a>${
    actions.length ? `<nav class="site-actions">${actions.join('')}</nav>` : ''
  }</div>${
    settings.showDescription && settings.description
      ? `<p class="tagline">${escapeHtml(settings.description)}</p>` : ''
  }</header>`
}

/**
 * The footer, with the sign-up form in it.
 *
 * The form is real markup with a method and an action, and `/api/subscribe` answers a form
 * post with a page. It lives on EVERY page rather than only on articles, so the header's
 * subscribe link always has somewhere to go.
 */
export function siteFooter(settings: SiteSettings, opts: ChromeOptions): string {
  const s = t(settings.language)
  const form = opts.mailConfigured
    ? `<form class="subscribe" id="subscribe" method="post" action="/api/subscribe">
<label for="sub-email">${escapeHtml(s.nlHeading)}</label>
<span class="subscribe-row"><input id="sub-email" type="email" name="email" required
 placeholder="${escapeAttr(s.nlPlaceholder)}"><button type="submit">${escapeHtml(s.nlButton)}</button></span>
<p class="subscribe-status" role="status"></p>
</form>`
    : ''
  // Limited inline markdown with {year} and {title} tokens, exactly as the frozen tree
  // rendered it. `renderInlineMarkdown` is the sanitiser, so this is not raw owner HTML.
  const footerText = settings.footer
    ? `<p class="footer-text">${renderInlineMarkdown(expandFooterTokens(settings.footer, settings.title))}</p>`
    : ''
  return `<footer class="site">${form}${footerText}</footer>`
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
    nlSuccess: s.nlSuccess,
    nlNoMail: s.nlNoMail,
    nlInvalid: s.nlInvalid,
    nlError: s.nlError,
  }
}
