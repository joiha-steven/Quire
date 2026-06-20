// Site settings data access. Stored at settings/site.json on Blob.
// Reads are resilient: any failure (missing file, Blob down) falls back to
// defaults so the public header and <title> never crash.

import { unstable_cache } from 'next/cache'
import type { FeatureSettings, MenuItem, SeoSettings, SiteSettings, ThemeColors, ThemeSettings } from '@/types'
import { readJson, writeJson } from '@/lib/blob'
import { isSiteLang } from '@/locales/langs'

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
  }
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

const SETTINGS_PATH = 'settings/site.json'

// Neutral, almost-hueless palette (vibeblog redesign). Mirrors the fallback
// tokens in globals.css so a fresh install looks right without saving anything.
export const DEFAULT_THEME: ThemeSettings = {
  light: {
    bg: '#fbfbfa',
    text: '#26262b',
    heading: '#14141a',
    meta: '#8a8a90',
    link: '#14141a',
    rule: '#e9e9e4',
  },
  dark: {
    bg: '#0e0e0f',
    text: '#d4d4d8',
    heading: '#f1f1f2',
    meta: '#85858c',
    link: '#f1f1f2',
    rule: '#27272a',
  },
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
  contentWidth: 672,
  postsPerPage: 10,
  menu: [],
  theme: DEFAULT_THEME,
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

// CSS for the theme: variables on :root (light) and .dark (dark mode).
export function themeToCss(theme: ThemeSettings): string {
  const vars = (c: ThemeColors) =>
    `--c-bg:${c.bg};--c-text:${c.text};--c-heading:${c.heading};--c-meta:${c.meta};--c-link:${c.link};--c-rule:${c.rule}`
  return `:root{${vars(theme.light)}}.dark{${vars(theme.dark)}}`
}

// Clamp a possibly-invalid number into a range, falling back to a default.
function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  return Math.min(max, Math.max(min, Math.round(value)))
}

// Read settings merged over defaults. Returns defaults on any error.
// unstable_cache caches across requests; invalidated via revalidateTag('settings', ...) after saves.
export const getSettings = unstable_cache(
  async (): Promise<SiteSettings> => {
    try {
      const stored = await readJson<Partial<SiteSettings>>(SETTINGS_PATH, {})
      // Deep-merge theme + seo so older/partial stored configs keep every key.
      return {
        ...DEFAULT_SETTINGS,
        ...stored,
        siteUrl: sanitizeUrl(stored.siteUrl),
        theme: sanitizeTheme(stored.theme, DEFAULT_THEME),
        seo: sanitizeSeo(stored.seo, DEFAULT_SEO),
        features: sanitizeFeatures(stored.features, DEFAULT_FEATURES),
      }
    } catch (error) {
      console.error(`[ERROR] settings.getSettings: ${(error as Error).message}`)
      return DEFAULT_SETTINGS
    }
  },
  // Bump this key when the settings SHAPE changes: Vercel's Data Cache persists
  // across deployments, so a new field (e.g. seo.rss) would otherwise stay
  // absent from the cached object until the owner saved. v2 = seo + siteUrl; v3 = features.
  ['site-settings-v3'],
  { tags: ['settings'] },
)

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
    contentWidth: clampNumber(input.contentWidth, 360, 1600, current.contentWidth),
    postsPerPage: clampNumber(input.postsPerPage, 1, 100, current.postsPerPage),
    menu: sanitizeMenu(input.menu, current.menu),
    theme: sanitizeTheme(input.theme, current.theme),
    seo: sanitizeSeo(input.seo, current.seo),
    features: sanitizeFeatures(input.features, current.features),
  }
  await writeJson(SETTINGS_PATH, next)
  return next
}
