// PWA manifest, generated from the owner's settings so the installed app uses
// the live site title, palette, and uploaded app icon. Forced dynamic so a saved
// setting (title / icon / theme) is reflected the next time it's fetched.
// Installable + standalone only — no service worker (offline is intentionally
// out of scope), so this stays a thin, always-fresh descriptor.
import type { MetadataRoute } from 'next'
import { getSettings, resolveAppIcon, getDefaultTheme } from '@/lib/settings'

export const dynamic = 'force-dynamic'

// Best-effort MIME from the icon URL's extension; harmless if omitted, but most
// installers prefer an explicit type. Defaults to PNG (the bundled fallback).
function iconType(url: string): string {
  const ext = url.split('?')[0].split('.').pop()?.toLowerCase()
  if (ext === 'svg') return 'image/svg+xml'
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  if (ext === 'ico') return 'image/x-icon'
  return 'image/png'
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const settings = await getSettings()
  const icon = resolveAppIcon(settings)
  const type = iconType(icon)
  const bg = getDefaultTheme(settings.themes, settings.themePreset).light.bg

  return {
    name: settings.title,
    short_name: settings.title,
    description: settings.description || undefined,
    lang: settings.language,
    id: '/',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: bg,
    theme_color: bg,
    icons: [
      // `any` at two sizes covers the home-screen icon without corner-cropping;
      // a `maskable` entry lets adaptive Android launchers theme it (use a square
      // icon with a little padding so the crop stays clean).
      { src: icon, sizes: '192x192', type, purpose: 'any' },
      { src: icon, sizes: '512x512', type, purpose: 'any' },
      { src: icon, sizes: '512x512', type, purpose: 'maskable' },
    ],
  }
}
