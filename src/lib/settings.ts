// Site settings data access. Stored at settings/site.json on Blob.
// Reads are resilient: any failure (missing file, Blob down) falls back to
// defaults so the public header and <title> never crash.

import type { SiteSettings } from '@/types'
import { readJson, writeJson } from '@/lib/blob'

const SETTINGS_PATH = 'settings/site.json'

export const DEFAULT_SETTINGS: SiteSettings = {
  title: 'vibeblog',
  description: '',
  logoUrl: '',
  showLogo: false,
  showDescription: true,
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
    title: (input.title ?? current.title).trim() || DEFAULT_SETTINGS.title,
    description: input.description ?? current.description,
    logoUrl: input.logoUrl ?? current.logoUrl,
    showLogo: input.showLogo ?? current.showLogo,
    showDescription: input.showDescription ?? current.showDescription,
  }
  await writeJson(SETTINGS_PATH, next)
  return next
}
