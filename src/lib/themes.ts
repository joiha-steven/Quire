// Built-in palettes (6 tokens × light+dark, emitted by `themesToCss`). All live in
// `settings.themes` (id -> ThemeSettings), each owner-customizable; `themePreset`
// names the visitor default (switchable via PaletteToggle). `name` is the English
// fallback — the displayed name is localized via `paletteNames`, keyed by id.

import type { ThemeColors, ThemeSettings, TypographySettings, TypeRole, FontSettings } from '@/types'

export type ThemePreset = {
  id: string
  name: string
  theme: ThemeSettings
}

// Render order for the role editor + CSS emit. Each role is fully tunable
// (size/line/spacing). Lives here (client-safe) so the settings UI imports it.
export const TYPE_ROLES: TypeRole[] = ['h1', 'h2', 'h3', 'h4', 'h5', 'body', 'small', 'caption', 'code']

// Custom-font weight slots (one upload each; all share the family).
export const FONT_WEIGHTS = [400, 500, 600, 700] as const

// Default type system (client-safe so the settings UI imports it for reset).
// Tuned for long-form reading the way fine European book typography is set:
//  - 18px body (--fs-body 1.125rem) at a ~66-char measure (contentWidth 672) — the
//    classic 60-75 cpl comfort zone (Bringhurst's ideal ~66).
//  - Body leading 1.7: airy enough for screens, a touch tighter than the old 1.75
//    so the column reads as an even grey block rather than spaced-out lines.
//  - A restrained, monotonic heading scale (h1 2.0 → h5 1.0). Headings stay modest
//    (books differentiate with weight + whitespace, not size); larger sizes take
//    tighter leading + a little negative tracking, body/small stay at 0.
//  - h4 sits just above body; h5 is the small label (was 0.9, below body — fixed).
// Mirror any change in globals.css :root (the no-JS fallback) AND the table in
// docs/conventions.md.
export const DEFAULT_TYPOGRAPHY: TypographySettings = {
  roles: {
    h1: { size: 2.0, line: 1.2, spacing: -0.02 },
    h2: { size: 1.5, line: 1.27, spacing: -0.015 },
    h3: { size: 1.25, line: 1.35, spacing: -0.01 },
    h4: { size: 1.15, line: 1.45, spacing: -0.006 },
    h5: { size: 1.0, line: 1.5, spacing: 0 },
    body: { size: 1.125, line: 1.7, spacing: 0 },
    small: { size: 0.875, line: 1.55, spacing: 0 },
    caption: { size: 0.8125, line: 1.5, spacing: 0.003 },
    code: { size: 0.875, line: 1.6, spacing: 0 },
  },
  smoothing: false,
}

// Default typeface: none uploaded → the bundled Inter.
export const DEFAULT_FONT: FontSettings = { family: '', faces: [] }

// TRUE neutral grayscale — zero hue, the Quire Blog house style. (Earlier values had a
// faint warm/blue cast: bg/rule read as cream, meta/text leaned blue. All pure gray
// now; `rule` is a touch lighter so the menu hover reads as a soft, colourless gray.)
const MONO: ThemeSettings = {
  light: { bg: '#fcfcfc', text: '#262626', heading: '#121212', meta: '#8c8c8c', link: '#121212', accent: '#121212', rule: '#ebebeb' },
  dark: { bg: '#0e0e0e', text: '#d6d6d6', heading: '#f2f2f2', meta: '#888888', link: '#f2f2f2', accent: '#f2f2f2', rule: '#262626' },
}

// Warm paper + brown ink — classic long-read comfort, terracotta accent.
const SEPIA: ThemeSettings = {
  light: { bg: '#f6f1e7', text: '#44372a', heading: '#2c2218', meta: '#9a8c79', link: '#9a5b34', accent: '#9a5b34', rule: '#e3d8c4' },
  dark: { bg: '#211b14', text: '#ddd0bd', heading: '#f2e9d8', meta: '#9c8e79', link: '#d79b6c', accent: '#d79b6c', rule: '#3a3025' },
}

// Earthy greens — calm, natural, forest-green accent.
const FOREST: ThemeSettings = {
  light: { bg: '#f5f7f2', text: '#2c352c', heading: '#1c241c', meta: '#84907f', link: '#3f7d4f', accent: '#3f7d4f', rule: '#dde5d8' },
  dark: { bg: '#0f140f', text: '#cdd6c8', heading: '#e9efe5', meta: '#7e8a78', link: '#79b389', accent: '#79b389', rule: '#252e23' },
}

// Cool blues — crisp and editorial, ocean-blue accent.
const OCEAN: ThemeSettings = {
  light: { bg: '#f4f7fa', text: '#28323d', heading: '#16202b', meta: '#7f8c99', link: '#2c6fb3', accent: '#2c6fb3', rule: '#dbe4ec' },
  dark: { bg: '#0c121a', text: '#c7d2dd', heading: '#e8eef5', meta: '#7c8a98', link: '#6aa9e0', accent: '#6aa9e0', rule: '#202a36' },
}

// Sci-fi — cool graphite surface with an electric cyan accent. Crisp + techy;
// the dark mode (deep blue-black + bright cyan) is where it really reads as sci-fi.
const SCIFI: ThemeSettings = {
  light: { bg: '#f2f5f7', text: '#1e2a33', heading: '#0d161e', meta: '#74828f', link: '#0e8aa0', accent: '#0e8aa0', rule: '#dce4ea' },
  dark: { bg: '#0a0f15', text: '#c3d2dc', heading: '#e7f1f7', meta: '#71808c', link: '#36cfe0', accent: '#36cfe0', rule: '#1b2630' },
}

// Warm-neutral surface with a vivid amber accent — confident and bright.
const AMBER: ThemeSettings = {
  light: { bg: '#fcfbf8', text: '#2e2a26', heading: '#1a1714', meta: '#918b82', link: '#c2710c', accent: '#c2710c', rule: '#ece7df' },
  dark: { bg: '#100f0d', text: '#d6d2ca', heading: '#f3f0ea', meta: '#8a857c', link: '#e8a13c', accent: '#e8a13c', rule: '#272420' },
}

// Order = display order in the picker. First entry is the default.
export const THEME_PRESETS: ThemePreset[] = [
  { id: 'mono', name: 'Mono', theme: MONO },
  { id: 'sepia', name: 'Sepia', theme: SEPIA },
  { id: 'forest', name: 'Forest', theme: FOREST },
  { id: 'ocean', name: 'Ocean', theme: OCEAN },
  { id: 'scifi', name: 'Sci-Fi', theme: SCIFI },
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

// A fresh id -> palette map seeded from the built-ins (the owner can then
// customize any of them). Cloned so edits never touch the preset constants.
export function defaultThemes(): Record<string, ThemeSettings> {
  const out: Record<string, ThemeSettings> = {}
  for (const p of THEME_PRESETS) out[p.id] = cloneTheme(p.theme)
  return out
}

// The palette a visitor sees by default (owner's `themePreset`), falling back to
// the first preset. Always returns a usable ThemeSettings.
export function getDefaultTheme(themes: Record<string, ThemeSettings>, defaultId: string): ThemeSettings {
  return themes[defaultId] ?? themes[DEFAULT_PRESET_ID] ?? THEME_PRESETS[0].theme
}

// Every built-in palette id, in display order. The default "everything on" set.
export const ALL_PALETTE_IDS: string[] = THEME_PRESETS.map((p) => p.id)

// Compact palette list for the client switcher: preset order, display name, and
// the (customized) light colors used to render the preview swatch.
export function paletteOptions(themes: Record<string, ThemeSettings>): { id: string; name: string; light: ThemeColors }[] {
  return THEME_PRESETS.map((p) => ({ id: p.id, name: p.name, light: (themes[p.id] ?? p.theme).light }))
}

// Switcher options limited to the visitor-enabled palettes (preset order kept).
export function enabledPaletteOptions(
  themes: Record<string, ThemeSettings>,
  enabled: string[],
): { id: string; name: string; light: ThemeColors }[] {
  const on = new Set(enabled)
  return paletteOptions(themes).filter((p) => on.has(p.id))
}

function vars(c: ThemeColors): string {
  return `--c-bg:${c.bg};--c-text:${c.text};--c-heading:${c.heading};--c-meta:${c.meta};--c-link:${c.link};--c-accent:${c.accent};--c-rule:${c.rule}`
}

// CSS for EVERY palette so the switcher swaps instantly via `<html data-palette>`.
// Default also lands on :root/.dark (no-JS baseline); mode-qualified
// `[data-palette].dark` has higher specificity so dark resolves correctly.
export function themesToCss(themes: Record<string, ThemeSettings>, defaultId: string): string {
  const base = getDefaultTheme(themes, defaultId)
  let css = `:root{${vars(base.light)}}.dark{${vars(base.dark)}}`
  for (const [id, t] of Object.entries(themes)) {
    css += `[data-palette="${id}"]{${vars(t.light)}}[data-palette="${id}"].dark{${vars(t.dark)}}`
  }
  return css
}
