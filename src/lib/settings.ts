// Site settings data access. Stored at settings/site.json on Blob.
// Reads are resilient: any failure (missing file, Blob down) falls back to
// defaults so the public header and <title> never crash.

import type { MenuItem, SiteSettings, ThemeColors, ThemeSettings } from '@/types'
import { readJson, writeJson } from '@/lib/blob'

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

const SETTINGS_PATH = 'settings/site.json'

export const DEFAULT_THEME: ThemeSettings = {
  light: {
    bg: '#ffffff',
    text: '#242424',
    heading: '#111111',
    meta: '#737373',
    link: '#2563eb',
    rule: '#d4d4d4',
  },
  dark: {
    bg: '#0a0a0a',
    text: '#cfcfcf',
    heading: '#ffffff',
    meta: '#a3a3a3',
    link: '#7fb0ff',
    rule: '#404040',
  },
}

export const DEFAULT_SETTINGS: SiteSettings = {
  language: 'vi',
  title: 'vibeblog',
  description: '',
  logoUrl: '',
  logoWidth: 120,
  showLogo: false,
  showDescription: true,
  contentWidth: 672,
  menu: [],
  theme: DEFAULT_THEME,
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
export async function getSettings(): Promise<SiteSettings> {
  try {
    const stored = await readJson<Partial<SiteSettings>>(SETTINGS_PATH, {})
    // Deep-merge theme so older/partial stored configs keep all color keys.
    return { ...DEFAULT_SETTINGS, ...stored, theme: sanitizeTheme(stored.theme, DEFAULT_THEME) }
  } catch (error) {
    console.error(`[ERROR] settings.getSettings: ${(error as Error).message}`)
    return DEFAULT_SETTINGS
  }
}

// Merge a partial update over current settings and persist. Returns the result.
export async function saveSettings(input: Partial<SiteSettings>): Promise<SiteSettings> {
  const current = await getSettings()
  const next: SiteSettings = {
    language: input.language === 'en' || input.language === 'vi' ? input.language : current.language,
    title: (input.title ?? current.title).trim() || DEFAULT_SETTINGS.title,
    description: input.description ?? current.description,
    logoUrl: input.logoUrl ?? current.logoUrl,
    logoWidth: clampNumber(input.logoWidth, 24, 600, current.logoWidth),
    showLogo: input.showLogo ?? current.showLogo,
    showDescription: input.showDescription ?? current.showDescription,
    contentWidth: clampNumber(input.contentWidth, 360, 1600, current.contentWidth),
    menu: sanitizeMenu(input.menu, current.menu),
    theme: sanitizeTheme(input.theme, current.theme),
  }
  await writeJson(SETTINGS_PATH, next)
  return next
}
