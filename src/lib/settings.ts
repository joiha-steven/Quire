// Site settings data access. Stored as a single row (id=1) in Postgres `settings`.
// Reads are resilient: any failure (missing row, DB down) falls back to defaults
// so the public header and <title> never crash. Image refs inside settings live
// store-relative; binaries themselves stay on Vercel Blob.

import { cache } from 'react'
import type { FeatureSettings, FontSettings, MenuItem, SeoSettings, SiteSettings, ThemeColors, ThemeSettings, TypographySettings } from '@/types'
import { collapseBlob, expandBlob } from '@/lib/blob'
import { db } from '@/lib/db'
import { isSiteLang } from '@/locales/langs'
import { DEFAULT_PRESET_ID, isPresetId, defaultThemes, THEME_PRESETS, DEFAULT_TYPOGRAPHY, DEFAULT_FONT } from '@/lib/themes'

// Re-export so existing importers keep working.
export { DEFAULT_THEME, themesToCss, getDefaultTheme, DEFAULT_TYPOGRAPHY, DEFAULT_FONT } from '@/lib/themes'

// Keep only well-formed menu items (label + href both present).
function sanitizeMenu(input: unknown, fallback: MenuItem[]): MenuItem[] {
  if (!Array.isArray(input)) return fallback
  return input
    .filter((m): m is MenuItem => !!m && typeof m.label === 'string' && typeof m.href === 'string')
    .map((m) => ({ label: m.label.trim(), href: m.href.trim() }))
    .filter((m) => m.label && m.href)
}

const HEX = /^#[0-9a-fA-F]{3,8}$/

// Validate one color, falling back when malformed.
function color(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX.test(value.trim()) ? value.trim() : fallback
}

// Merge a partial color set over a fallback set.
function sanitizeColors(input: unknown, fallback: ThemeColors): ThemeColors {
  const o = (input ?? {}) as Partial<ThemeColors>
  return {
    bg: color(o.bg, fallback.bg),
    text: color(o.text, fallback.text),
    heading: color(o.heading, fallback.heading),
    meta: color(o.meta, fallback.meta),
    link: color(o.link, fallback.link),
    rule: color(o.rule, fallback.rule),
  }
}

function sanitizeTheme(input: unknown, fallback: ThemeSettings): ThemeSettings {
  const o = (input ?? {}) as Partial<ThemeSettings>
  return {
    light: sanitizeColors(o.light, fallback.light),
    dark: sanitizeColors(o.dark, fallback.dark),
  }
}

// Back-compat: older configs stored a single `theme`. Seed it into the (then-)
// default palette so the owner's custom colors survive the move to per-palette.
function migrateThemes(stored: Record<string, unknown>): Record<string, ThemeSettings> {
  const base = defaultThemes()
  const legacy = stored.theme
  if (stored.themes == null && legacy) {
    const def = isPresetId(stored.themePreset) ? (stored.themePreset as string) : DEFAULT_PRESET_ID
    base[def] = sanitizeTheme(legacy, base[def])
  }
  return base
}

// Sanitize the per-palette map: for every known preset id, merge the stored
// colors over `base` (current or built-in). Ids outside the presets are dropped.
function sanitizeThemes(input: unknown, base: Record<string, ThemeSettings>): Record<string, ThemeSettings> {
  const o = (input ?? {}) as Record<string, unknown>
  const out: Record<string, ThemeSettings> = {}
  for (const p of THEME_PRESETS) {
    out[p.id] = sanitizeTheme(o[p.id], base[p.id] ?? p.theme)
  }
  return out
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)

function sanitizeSeo(input: unknown, fallback: SeoSettings): SeoSettings {
  const o = (input ?? {}) as Partial<SeoSettings>
  return {
    autoSchema: bool(o.autoSchema, fallback.autoSchema),
    sitemap: bool(o.sitemap, fallback.sitemap),
    llms: bool(o.llms, fallback.llms),
    robots: bool(o.robots, fallback.robots),
    rss: bool(o.rss, fallback.rss),
    ogImage: bool(o.ogImage, fallback.ogImage),
    // A full image URL (keep the path); only the type is validated.
    ogFallbackImage: typeof o.ogFallbackImage === 'string' ? o.ogFallbackImage.trim() : fallback.ogFallbackImage,
  }
}

function sanitizeFeatures(input: unknown, fallback: FeatureSettings): FeatureSettings {
  const o = (input ?? {}) as Partial<FeatureSettings>
  return {
    search: bool(o.search, fallback.search),
    toc: bool(o.toc, fallback.toc),
    related: bool(o.related, fallback.related),
    readingTime: bool(o.readingTime, fallback.readingTime),
    progressBar: bool(o.progressBar, fallback.progressBar),
    activityLog: bool(o.activityLog, fallback.activityLog),
  }
}

// Owner-authored CSS, injected raw into a <style> on public pages. Owner-only, so
// the only real hazard is an accidental `</style>` closing the tag early — strip
// any such sequence; everything else is passed through untouched.
function sanitizeCss(value: unknown): string {
  return typeof value === 'string' ? value.replace(/<\/style/gi, '') : ''
}

// Accept only a valid http(s) URL with no trailing slash; '' otherwise.
function sanitizeUrl(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return ''
  try {
    const u = new URL(value.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return ''
    return u.origin
  } catch {
    return ''
  }
}

export const DEFAULT_SEO: SeoSettings = {
  autoSchema: true,
  sitemap: true,
  llms: true,
  robots: true,
  rss: true,
  ogImage: true,
  ogFallbackImage: '',
}

export const DEFAULT_FEATURES: FeatureSettings = {
  search: true,
  toc: true,
  related: true,
  readingTime: true,
  progressBar: true,
  activityLog: true,
}

// Clamp a float into [min,max], keeping up to 2 decimals; fall back when invalid.
function clampFloat(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value * 100) / 100))
}

function sanitizeTypography(input: unknown, fallback: TypographySettings): TypographySettings {
  const o = (input ?? {}) as Partial<TypographySettings>
  return {
    base: clampFloat(o.base, 0.5, 6, fallback.base),
    h1: clampFloat(o.h1, 0.5, 6, fallback.h1),
    h2: clampFloat(o.h2, 0.5, 6, fallback.h2),
    h3: clampFloat(o.h3, 0.5, 6, fallback.h3),
    h4: clampFloat(o.h4, 0.5, 6, fallback.h4),
    h5: clampFloat(o.h5, 0.5, 6, fallback.h5),
    lineHeight: clampFloat(o.lineHeight, 1, 3, fallback.lineHeight),
    letterSpacing: clampFloat(o.letterSpacing, -0.1, 0.5, fallback.letterSpacing),
    smoothing: bool(o.smoothing, fallback.smoothing),
  }
}

// Family name -> safe CSS identifier (owner-only, but never trust raw into a
// <style>): allow letters/digits/space/hyphen, collapse the rest.
function sanitizeFamily(value: unknown): string {
  return typeof value === 'string' ? value.replace(/[^A-Za-z0-9 _-]/g, '').trim().slice(0, 64) : ''
}

function sanitizeFont(input: unknown, fallback: FontSettings): FontSettings {
  const o = (input ?? {}) as Partial<FontSettings>
  const family = o.family !== undefined ? sanitizeFamily(o.family) : fallback.family
  const url = typeof o.url === 'string' ? o.url.trim() : fallback.url
  // Both must be present to register a font; otherwise fall back to "no font".
  return family && url ? { url, family } : DEFAULT_FONT
}

// font URL -> @font-face `format(...)` hint, by extension. Unknown -> omit it.
function fontFormat(url: string): string {
  const ext = url.split(/[?#]/)[0].split('.').pop()?.toLowerCase()
  return ext === 'woff2' ? 'woff2' : ext === 'woff' ? 'woff' : ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ''
}

// Emit the type-scale + rhythm CSS variables on :root (plus the optional
// font-smoothing rule). Injected after globals.css (whose :root carries the same
// defaults), so a saved scale wins while a fresh install still renders correctly.
export function typographyToCss(t: TypographySettings): string {
  const vars =
    `:root{--fs-base:${t.base}rem;--fs-h1:${t.h1}rem;--fs-h2:${t.h2}rem;--fs-h3:${t.h3}rem;` +
    `--fs-h4:${t.h4}rem;--fs-h5:${t.h5}rem;--lh-body:${t.lineHeight};--ls-body:${t.letterSpacing}em}`
  const smooth = t.smoothing ? `body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}` : ''
  return vars + smooth
}

// Emit the @font-face for an owner-uploaded typeface and point --font-sans at it
// (Inter stays the fallback). Empty when no font is set.
export function fontToCss(f: FontSettings): string {
  if (!f.url || !f.family) return ''
  const fmt = fontFormat(f.url)
  const src = `url('${f.url}')${fmt ? ` format('${fmt}')` : ''}`
  return (
    `@font-face{font-family:'${f.family}';src:${src};font-display:swap}` +
    `:root{--font-sans:'${f.family}', var(--font-inter)}`
  )
}

export const DEFAULT_SETTINGS: SiteSettings = {
  language: 'en',
  title: 'vibeblog',
  description: '',
  siteUrl: '',
  logoUrl: '',
  logoWidth: 120,
  showLogo: false,
  showDescription: true,
  faviconUrl: '',
  appIconUrl: '',
  contentWidth: 672,
  postsPerPage: 10,
  relatedCount: 3,
  excerptLength: 50,
  customCss: '',
  menu: [],
  themePreset: DEFAULT_PRESET_ID,
  themes: defaultThemes(),
  typography: DEFAULT_TYPOGRAPHY,
  customFont: DEFAULT_FONT,
  seo: DEFAULT_SEO,
  features: DEFAULT_FEATURES,
}

// Resolve the canonical base URL: owner-set value wins, else the Vercel
// production domain, else localhost (dev). Always without a trailing slash.
export function resolveSiteUrl(s: SiteSettings): string {
  if (s.siteUrl) return s.siteUrl
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (vercel) return `https://${vercel}`
  return 'http://localhost:3000'
}

// The effective PWA / home-screen icon: owner's app icon wins, else the favicon,
// else the bundled default (`/app-icon.png`). Always returns a usable URL.
export function resolveAppIcon(s: SiteSettings): string {
  return s.appIconUrl || s.faviconUrl || '/app-icon.png'
}

// Clamp a possibly-invalid number into a range, falling back to a default.
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

// Read settings merged over defaults. Returns defaults on any error. No
// cross-request cache (`React.cache` dedupes within one render only), so a saved
// setting is live on the next request — no cache-key versioning to maintain.
export const getSettings = cache(async (): Promise<SiteSettings> => {
  try {
    const { data: row } = await db().from('settings').select('data').eq('id', 1).maybeSingle()
    const stored = (row?.data ?? {}) as Partial<SiteSettings>
    // Deep-merge theme + seo so older/partial stored configs keep every key.
    const seo = sanitizeSeo(stored.seo, DEFAULT_SEO)
    // Image refs are stored store-relative; expand to absolute Blob URLs for use.
    return {
      ...DEFAULT_SETTINGS,
      ...stored,
      logoUrl: expandBlob(stored.logoUrl ?? DEFAULT_SETTINGS.logoUrl),
      faviconUrl: expandBlob(stored.faviconUrl ?? DEFAULT_SETTINGS.faviconUrl),
      appIconUrl: expandBlob(stored.appIconUrl ?? DEFAULT_SETTINGS.appIconUrl),
      siteUrl: sanitizeUrl(stored.siteUrl),
      relatedCount: clampNumber(stored.relatedCount, 0, 12, DEFAULT_SETTINGS.relatedCount),
      excerptLength: clampNumber(stored.excerptLength, 10, 100, DEFAULT_SETTINGS.excerptLength),
      customCss: sanitizeCss(stored.customCss),
      themePreset: isPresetId(stored.themePreset) ? stored.themePreset : DEFAULT_PRESET_ID,
      themes: sanitizeThemes(stored.themes, migrateThemes(stored as Record<string, unknown>)),
      typography: sanitizeTypography(stored.typography, DEFAULT_TYPOGRAPHY),
      customFont: (() => {
        const f = sanitizeFont(stored.customFont, DEFAULT_FONT)
        return f.url ? { ...f, url: expandBlob(f.url) } : f
      })(),
      seo: { ...seo, ogFallbackImage: expandBlob(seo.ogFallbackImage) },
      features: sanitizeFeatures(stored.features, DEFAULT_FEATURES),
    }
  } catch (error) {
    console.error(`[ERROR] settings.getSettings: ${(error as Error).message}`)
    return DEFAULT_SETTINGS
  }
})

// Merge a partial update over current settings and persist. Returns the result.
export async function saveSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings()
  const next: SiteSettings = {
    language: isSiteLang(input.language) ? input.language : current.language,
    title: (input.title ?? current.title).trim() || DEFAULT_SETTINGS.title,
    description: input.description ?? current.description,
    siteUrl: input.siteUrl !== undefined ? sanitizeUrl(input.siteUrl) : current.siteUrl,
    logoUrl: input.logoUrl ?? current.logoUrl,
    logoWidth: clampNumber(input.logoWidth, 24, 600, current.logoWidth),
    showLogo: input.showLogo ?? current.showLogo,
    showDescription: input.showDescription ?? current.showDescription,
    faviconUrl: input.faviconUrl ?? current.faviconUrl,
    appIconUrl: input.appIconUrl ?? current.appIconUrl,
    contentWidth: clampNumber(input.contentWidth, 360, 1600, current.contentWidth),
    postsPerPage: clampNumber(input.postsPerPage, 1, 100, current.postsPerPage),
    relatedCount: clampNumber(input.relatedCount, 0, 12, current.relatedCount),
    excerptLength: clampNumber(input.excerptLength, 10, 100, current.excerptLength),
    customCss: input.customCss !== undefined ? sanitizeCss(input.customCss) : current.customCss,
    menu: sanitizeMenu(input.menu, current.menu),
    themePreset: isPresetId(input.themePreset) ? input.themePreset : current.themePreset,
    themes: sanitizeThemes(input.themes, current.themes),
    typography: sanitizeTypography(input.typography, current.typography),
    customFont: sanitizeFont(input.customFont, current.customFont),
    seo: sanitizeSeo(input.seo, current.seo),
    features: sanitizeFeatures(input.features, current.features),
  }
  // Persist image refs store-relative (collapse); keep `next` absolute for the client.
  const stored: SiteSettings = {
    ...next,
    logoUrl: collapseBlob(next.logoUrl),
    faviconUrl: collapseBlob(next.faviconUrl),
    appIconUrl: collapseBlob(next.appIconUrl),
    customFont: next.customFont.url ? { ...next.customFont, url: collapseBlob(next.customFont.url) } : next.customFont,
    seo: { ...next.seo, ogFallbackImage: collapseBlob(next.seo.ogFallbackImage) },
  }
  await db().from('settings').upsert({ id: 1, data: stored })
  return next
}
