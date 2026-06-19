// Site settings data access. Stored at settings/site.json on Blob.
// Reads are resilient: any failure (missing file, Blob down) falls back to
// defaults so the public header and <title> never crash.

import type { SiteSettings } from '@/types'
import { readJson, writeJson } from '@/lib/blob'

const SETTINGS_PATH = 'settings/site.json'

export const DEFAULT_SETTINGS: SiteSettings = {
  language: 'vi',
  title: 'vibeblog',
  description: '',
  logoUrl: '',
  logoWidth: 120,
  showLogo: false,
  showDescription: true,
  contentWidth: 672,
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
    return { ...DEFAULT_SETTINGS, ...stored }
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
  }
  await writeJson(SETTINGS_PATH, next)
  return next
}
