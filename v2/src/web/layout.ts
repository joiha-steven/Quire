// The HTML shell every public page is rendered into.
//
// The resource-loading law (docs/performance.md, carried into 04-frontend.md) is enforced
// structurally here rather than by convention:
//
//   * Critical CSS is INLINE. One stylesheet request removed from the critical path, and
//     the public sheet is small precisely because it is hand-written.
//   * Reading-font subsets are PRELOADED, chosen by language, because the font is the LCP
//     resource and the browser cannot discover it until the CSS has parsed.
//   * Scripts are opt-in per route and their sizes are a BUDGET the build enforces
//     (`scripts/build-assets.ts`), so a listing pays for the beacon and the header alone
//     and an article adds one more file. Nothing is inlined, and there is no framework.

import type { SiteSettings } from '@/types'
import { fontPreloadHrefs, fontPresetCss, chromeFontCss, themesToCss } from '@/content/themes'
import { typographyToCss, fontToCss } from '@/content/settings'
import { singleRailCss } from '@/render/rail-css'
import { fontFaceCss, MONO_TRACKING } from '@/render/font-faces'

export type Head = {
  title: string
  description?: string
  canonical?: string
  /** Absolute URL of the Open Graph image. Undefined means no card. */
  image?: string
  /** `article` for a post, `website` for everything else. */
  ogType?: 'article' | 'website'
  /** Rendered verbatim into <head>. Callers pass already-escaped markup. */
  extra?: string
}

/** The parts of the document outside `<head>` that a route can vary. */
export type Shell = {
  /**
   * `data-*` attributes on `<body>`. Every string an island shows a reader is translated
   * on the server and handed over here, so a bundle carries no locale table and cannot
   * disagree with the page it is running on. A key of `backToTop` becomes
   * `data-back-to-top`, which the browser reads back as `dataset.backToTop`.
   */
  bodyData?: Record<string, string>
  /** Script tags, rendered last so nothing blocks the parse. */
  scripts?: string
}

/** `backToTop` -> `data-back-to-top`. The inverse of the browser's `dataset` mapping. */
const dataAttr = (key: string) => `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const escapeAttr = (s: string) => escapeHtml(s).replace(/"/g, '&quot;')

/**
 * The one stylesheet a reader loads, assembled from the owner's settings.
 *
 * Order is load-bearing: the base sheet first, then the preset fonts, then typography,
 * then the owner's custom font and CSS. Each later layer is allowed to win, and a fresh
 * install with nothing configured still gets a complete sheet.
 */
export function pageStyles(settings: SiteSettings, base: string, extra = ''): string {
  return [
    // FIRST: a family has to be declared before anything can ask for it by name.
    fontFaceCss(settings.fontPreset, settings.chromeFont),
    // The chrome face, and the reading face's fallback until a preset repoints it. Inter
    // is the universal base, exactly as in the frozen tree.
    `:root{--font-sans:'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif;`
    + `--font-reading:var(--font-sans)}`,
    base,
    // The reading column, from the owner's setting. A two-rail listing narrows it by
    // overriding this later in the sheet, which is why it is a variable and not baked in.
    `:root{--shell-w:${settings.contentWidth}px}`,
    // Injected at runtime, not written by hand, because a media query cannot read a CSS
    // variable and the breakpoint is COMPUTED from the reading column: the rail only moves
    // into the gutter when there is room for it on BOTH sides, so the column stays centred.
    singleRailCss(settings.contentWidth),
    // Page-specific geometry: the listing's second rail, the feed's gutter timeline. It
    // comes BEFORE the owner's own settings, so custom CSS still has the last word.
    extra,
    fontPresetCss(settings.fontPreset),
    chromeFontCss(settings.chromeFont),
    themesToCss(settings.themes, settings.themePreset),
    typographyToCss(settings.typography),
    fontToCss(settings.customFont),
    // Keyed on `data-chrome-font`, which `renderDocument` puts on <html>. It has to come
    // after the chrome font is resolved and before the owner's own CSS can override it.
    MONO_TRACKING,
    settings.customCss,
  ].filter(Boolean).join('\n')
}

export function renderDocument(
  settings: SiteSettings,
  head: Head,
  styles: string,
  body: string,
  shell: Shell = {},
): string {
  const bodyAttrs = Object.entries(shell.bodyData ?? {})
    .map(([k, v]) => ` ${dataAttr(k)}="${escapeAttr(v)}"`)
    .join('')
  const preloads = fontPreloadHrefs(settings.fontPreset, settings.language, !!settings.customFont.family)
    .map((href) => `<link rel="preload" href="${escapeAttr(href)}" as="font" type="font/woff2" crossorigin>`)
    .join('')
  const description = head.description
    ? `<meta name="description" content="${escapeAttr(head.description)}">`
    : ''
  const canonical = head.canonical ? `<link rel="canonical" href="${escapeAttr(head.canonical)}">` : ''

  // Open Graph and Twitter. Written out rather than generated from a map: there are seven
  // of them, they are not going to become a hundred, and a loop here would be harder to
  // read than the tags themselves.
  //
  // `summary_large_image` ONLY when there is an image. With `summary_large_image` and no
  // image, X renders a bare card with the site's favicon stretched across it.
  const meta = (property: string, content: string) =>
    `<meta property="${property}" content="${escapeAttr(content)}">`
  const og = [
    meta('og:title', head.title),
    meta('og:type', head.ogType ?? 'website'),
    head.description ? meta('og:description', head.description) : '',
    head.canonical ? meta('og:url', head.canonical) : '',
    meta('og:site_name', settings.title),
    head.image ? meta('og:image', head.image) : '',
    `<meta name="twitter:card" content="${head.image ? 'summary_large_image' : 'summary'}">`,
  ].filter(Boolean).join('')
  const icon = settings.faviconUrl ? `<link rel="icon" href="${escapeAttr(settings.faviconUrl)}">` : ''
  // Without this link the manifest route exists and nothing ever asks for it, so the site
  // is not installable no matter what the route returns.
  const manifest = '<link rel="manifest" href="/manifest.webmanifest">'

  // `data-motion` and `data-chrome-font` are both read by CSS, not by script: the motion
  // switch zeroes every duration in one rule, and the chrome font selects the tracking
  // correction for the two mono faces. Both were missed in the port, so the owner's Motion
  // toggle did nothing and a mono chrome rendered untracked.
  const motion = settings.motion.enabled ? 'on' : 'off'
  return `<!DOCTYPE html>
<html lang="${escapeAttr(settings.language)}" data-motion="${motion}" data-chrome-font="${escapeAttr(settings.chromeFont)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(head.title)}</title>
${description}${canonical}${icon}${manifest}${og}${preloads}
<style>${styles}</style>
${head.extra ?? ''}
</head>
<body${bodyAttrs}>
${body}
${shell.scripts ?? ''}</body>
</html>
`
}
