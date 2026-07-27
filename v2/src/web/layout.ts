// The HTML shell every public page is rendered into.
//
// The resource-loading law (docs/performance.md, carried into 04-frontend.md) is enforced
// structurally here rather than by convention:
//
//   * Critical CSS is INLINE. One stylesheet request removed from the critical path, and
//     the public sheet is small precisely because it is hand-written.
//   * Reading-font subsets are PRELOADED, chosen by language, because the font is the LCP
//     resource and the browser cannot discover it until the CSS has parsed.
//   * There is NO script tag on an article page. Islands are opt-in per route, so 0 KB of
//     JavaScript is the default rather than an achievement.

import type { SiteSettings } from '@/types'
import { fontPreloadHrefs, fontPresetCss, chromeFontCss, themesToCss } from '@/content/themes'
import { typographyToCss, fontToCss } from '@/content/settings'

export type Head = {
  title: string
  description?: string
  canonical?: string
  /** Rendered verbatim into <head>. Callers pass already-escaped markup. */
  extra?: string
}

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
export function pageStyles(settings: SiteSettings, base: string): string {
  return [
    base,
    fontPresetCss(settings.fontPreset),
    chromeFontCss(settings.chromeFont),
    themesToCss(settings.themes, settings.themePreset),
    typographyToCss(settings.typography),
    fontToCss(settings.customFont),
    settings.customCss,
  ].filter(Boolean).join('\n')
}

export function renderDocument(
  settings: SiteSettings,
  head: Head,
  styles: string,
  body: string,
): string {
  const preloads = fontPreloadHrefs(settings.fontPreset, settings.language, !!settings.customFont.family)
    .map((href) => `<link rel="preload" href="${escapeAttr(href)}" as="font" type="font/woff2" crossorigin>`)
    .join('')
  const description = head.description
    ? `<meta name="description" content="${escapeAttr(head.description)}">`
    : ''
  const canonical = head.canonical ? `<link rel="canonical" href="${escapeAttr(head.canonical)}">` : ''
  const icon = settings.faviconUrl ? `<link rel="icon" href="${escapeAttr(settings.faviconUrl)}">` : ''

  return `<!DOCTYPE html>
<html lang="${escapeAttr(settings.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(head.title)}</title>
${description}${canonical}${icon}${preloads}
<style>${styles}</style>
${head.extra ?? ''}
</head>
<body>
${body}
</body>
</html>
`
}
