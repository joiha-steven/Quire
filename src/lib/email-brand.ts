// Resolve the site's visual identity for an email: palette + the masthead logo.
// One place, because all four senders (opt-in, broadcast, reply, test) must produce
// the same letterhead — and because picking the RIGHT logo file is not obvious.
// SERVER-ONLY (reads settings).

import type { EmailBrand, EmailLogo } from '@/lib/newsletter-email'
import type { SiteSettings } from '@/types'
import { getDefaultTheme } from '@/lib/themes'
import { resolveSiteUrl } from '@/lib/settings'

// Formats every mail client renders. Deliberately NOT webp: Outlook on Windows uses
// the Word engine and shows nothing for it, and SVG is stripped almost everywhere —
// so the site's derived `logoRenderUrl` (a WebP) is exactly the wrong file to send,
// even though it is the right one for the web header.
const MAIL_SAFE_IMAGE = /\.(png|jpe?g|gif)(\?|#|$)/i

// The logo to put in an email, or null to fall back to the site name as text.
// Uses the ORIGINAL upload (always kept, whatever the owner picked) rather than the
// display render: correctness in every inbox beats a few KB, and the original is
// usually larger than `logoWidth`, so it lands crisp on a retina screen for free.
export function emailLogo(settings: SiteSettings, base: string): EmailLogo | null {
  if (!settings.showLogo || !settings.logoUrl) return null
  if (!MAIL_SAFE_IMAGE.test(settings.logoUrl)) return null
  const url = /^https?:\/\//.test(settings.logoUrl)
    ? settings.logoUrl
    : `${base}${settings.logoUrl.startsWith('/') ? '' : '/'}${settings.logoUrl}`
  return {
    url,
    width: settings.logoWidth,
    // Aspect ratio is preserved by the render, so the derived height is the display
    // height of the original too. 0/undefined = unknown; then only width is set.
    height: settings.logoRenderHeight || undefined,
  }
}

export function emailBrand(settings: SiteSettings): EmailBrand {
  const base = resolveSiteUrl(settings)
  return {
    title: settings.title,
    base,
    theme: getDefaultTheme(settings.themes, settings.themePreset).light,
    logo: emailLogo(settings, base),
  }
}
