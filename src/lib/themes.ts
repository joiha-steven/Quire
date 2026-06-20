// Built-in color presets. Each preset is a full light+dark reading palette
// (the same 6 tokens the public site renders via themeToCss). Picking a preset
// fills `settings.theme` with its colors; `settings.themePreset` remembers which
// one so "reset" can restore THAT preset's defaults (not just the first one).
//
// Preset names are proper nouns (kept constant across locales, like "Solarized").
// Every palette is tuned so both modes stay readable: comfortable body contrast,
// a distinct accent link, and a rule/surface that reads as a faint tint.

import type { ThemeColors, ThemeSettings } from '@/types'

export type ThemePreset = {
  id: string
  name: string
  theme: ThemeSettings
}

// Neutral, almost-hueless grayscale — the vibeblog house style.
const MONO: ThemeSettings = {
  light: { bg: '#fbfbfa', text: '#26262b', heading: '#14141a', meta: '#8a8a90', link: '#14141a', rule: '#e9e9e4' },
  dark: { bg: '#0e0e0f', text: '#d4d4d8', heading: '#f1f1f2', meta: '#85858c', link: '#f1f1f2', rule: '#27272a' },
}

// Warm paper + brown ink — classic long-read comfort, terracotta accent.
const SEPIA: ThemeSettings = {
  light: { bg: '#f6f1e7', text: '#44372a', heading: '#2c2218', meta: '#9a8c79', link: '#9a5b34', rule: '#e3d8c4' },
  dark: { bg: '#211b14', text: '#ddd0bd', heading: '#f2e9d8', meta: '#9c8e79', link: '#d79b6c', rule: '#3a3025' },
}

// Earthy greens — calm, natural, forest-green accent.
const FOREST: ThemeSettings = {
  light: { bg: '#f5f7f2', text: '#2c352c', heading: '#1c241c', meta: '#84907f', link: '#3f7d4f', rule: '#dde5d8' },
  dark: { bg: '#0f140f', text: '#cdd6c8', heading: '#e9efe5', meta: '#7e8a78', link: '#79b389', rule: '#252e23' },
}

// Cool blues — crisp and editorial, ocean-blue accent.
const OCEAN: ThemeSettings = {
  light: { bg: '#f4f7fa', text: '#28323d', heading: '#16202b', meta: '#7f8c99', link: '#2c6fb3', rule: '#dbe4ec' },
  dark: { bg: '#0c121a', text: '#c7d2dd', heading: '#e8eef5', meta: '#7c8a98', link: '#6aa9e0', rule: '#202a36' },
}

// Soft rose + plum — warm and elegant, raspberry accent.
const ROSE: ThemeSettings = {
  light: { bg: '#fbf5f5', text: '#3d2f33', heading: '#2a1f24', meta: '#9c8a90', link: '#b14a63', rule: '#efe0e3' },
  dark: { bg: '#181113', text: '#ddccd0', heading: '#f3e7ea', meta: '#9d8990', link: '#e08aa0', rule: '#2e2226' },
}

// Warm-neutral surface with a vivid amber accent — confident and bright.
const AMBER: ThemeSettings = {
  light: { bg: '#fcfbf8', text: '#2e2a26', heading: '#1a1714', meta: '#918b82', link: '#c2710c', rule: '#ece7df' },
  dark: { bg: '#100f0d', text: '#d6d2ca', heading: '#f3f0ea', meta: '#8a857c', link: '#e8a13c', rule: '#272420' },
}

// Order = display order in the picker. First entry is the default.
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'mono', name: 'Mono', theme: MONO },
  { id: 'sepia', name: 'Sepia', theme: SEPIA },
  { id: 'forest', name: 'Forest', theme: FOREST },
  { id: 'ocean', name: 'Ocean', theme: OCEAN },
  { id: 'rose', name: 'Rosé', theme: ROSE },
  { id: 'amber', name: 'Amber', theme: AMBER },
]

export const DEFAULT_PRESET_ID = 'mono'

// The default palette every fresh install starts from (also the globals.css fallback).
export const DEFAULT_THEME: ThemeSettings = MONO

// Look up a preset by id, falling back to the default. Always returns a value.
export function getPreset(id: string): ThemePreset {
  return THEME_PRESETS.find((p) => p.id === id) ?? THEME_PRESETS[0]
}

export function isPresetId(id: unknown): id is string {
  return typeof id === 'string' && THEME_PRESETS.some((p) => p.id === id)
}

// Deep clone a palette so editing one mode never mutates a shared preset object.
export function cloneTheme(t: ThemeSettings): ThemeSettings {
  const copy = (c: ThemeColors): ThemeColors => ({ ...c })
  return { light: copy(t.light), dark: copy(t.dark) }
}
