// Site settings data access. Stored as a single row (id=1) in Postgres `settings`.
// Reads are resilient: any failure (missing row, DB down) falls back to defaults
// so the public header and <title> never crash. Image refs inside settings live
// store-relative; binaries themselves stay on Vercel Blob.

import { cache } from 'react'
import type { FeatureSettings, MenuItem, SeoSettings, SiteSettings, ThemeColors, ThemeSettings } from '@/types'
import { collapseBlob, expandBlob } from '@/lib/blob'
import { db } from '@/lib/db'
import { isSiteLang } from '@/locales/langs'
import { DEFAULT_PRESET_ID, isPresetId, defaultThemes, THEME_PRESETS } from '@/lib/themes'

// Re-export so existing importers keep working.
export { DEFAULT_THEME, themesToCss, getDefaultTheme } from '@/lib/themes'

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
    seo: sanitizeSeo(input.seo, current.seo),
    features: sanitizeFeatures(input.features, current.features),
  }
  // Persist image refs store-relative (collapse); keep `next` absolute for the client.
  const stored: SiteSettings = {
    ...next,
    logoUrl: collapseBlob(next.logoUrl),
    faviconUrl: collapseBlob(next.faviconUrl),
    appIconUrl: collapseBlob(next.appIconUrl),
    seo: { ...next.seo, ogFallbackImage: collapseBlob(next.seo.ogFallbackImage) },
  }
  await db().from('settings').upsert({ id: 1, data: stored })
  return next
}
