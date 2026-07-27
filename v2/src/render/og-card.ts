// The Open Graph card: 1200x630, rendered on the server, no browser involved.
//
// `next/og` was satori (JSX to SVG) plus a WASM rasteriser. Here it is satori plus sharp,
// which is already a dependency and already rasterises SVG. The element tree is built as
// plain objects rather than JSX: satori accepts either, and plain objects avoid giving this
// one file a different JSX pragma from the rest of the codebase.
//
// The layout is a straight port of `app/og/route.tsx`, down to the type sizes.

import satori, { type SatoriOptions } from 'satori'
import sharp from 'sharp'
import interLatin from '@/render/fonts/inter-latin.woff' with { type: 'file' }
import interLatinExt from '@/render/fonts/inter-latin-ext.woff' with { type: 'file' }
import interVietnamese from '@/render/fonts/inter-vietnamese.woff' with { type: 'file' }

export const OG_SIZE = { width: 1200, height: 630 } as const

export type OgCard = {
  /** The big top line. */
  title: string
  /** A middle line: a post's excerpt. Clamped to four lines. */
  desc?: string
  /** The bottom line. `date` wins over `site` when both are given. */
  date?: string
  site?: string
  /** Background image, already fetched, as a data URI. Absent means the gradient. */
  bg?: string
  /** The owner's font, already fetched. Absent means Inter. */
  customFont?: ArrayBuffer
}

// Loaded once. Three subsets, because a title can mix Vietnamese and ASCII and Inter ships
// them separately.
let fonts: SatoriOptions['fonts'] | null = null
async function interFonts(): Promise<SatoriOptions['fonts']> {
  if (fonts) return fonts
  const [latin, latinExt, vietnamese] = await Promise.all([
    Bun.file(interLatin).arrayBuffer(),
    Bun.file(interLatinExt).arrayBuffer(),
    Bun.file(interVietnamese).arrayBuffer(),
  ])
  // DISTINCT names with an explicit fallback chain. Under ONE name satori treats
  // overlapping subsets as a single font and double-renders any glyph present in more than
  // one: đ (U+0111) is in both latin-ext and vietnamese, and came out with two crossbars.
  fonts = [
    { name: 'Inter', data: latin, weight: 600, style: 'normal' },
    { name: 'InterExt', data: latinExt, weight: 600, style: 'normal' },
    { name: 'InterVN', data: vietnamese, weight: 600, style: 'normal' },
  ]
  return fonts
}

type Node = { type: string; props: Record<string, unknown> }
const div = (style: Record<string, unknown>, children?: unknown): Node =>
  ({ type: 'div', props: children === undefined ? { style } : { style, children } })

/** The layers over the background: a dark wash so white text stays legible on any image. */
const OVERLAY = 'linear-gradient(180deg, rgba(28,28,31,0.25) 0%, rgba(28,28,31,0.88) 100%)'
const GRADIENT = 'linear-gradient(135deg, #2a2a2e 0%, #1c1c1f 100%)'

function tree(card: OgCard, family: string): Node {
  // Smaller type for a longer title, so it never overflows the card.
  const titleSize = card.title.length > 90 ? 52 : card.title.length > 55 ? 60 : 72

  // `inset: 0` is NOT enough here. satori ignores it, so the overlay collapsed to zero
  // height and the card came back with white text on a bright photograph — legible in a
  // test that only checks the response is a PNG, and unreadable on Twitter. Absolute
  // offsets are spelled out on both layers.
  const cover = {
    position: 'absolute', top: 0, left: 0,
    width: OG_SIZE.width, height: OG_SIZE.height,
  } as const

  const layers: unknown[] = []
  if (card.bg) {
    layers.push({
      type: 'img',
      props: {
        src: card.bg,
        width: OG_SIZE.width,
        height: OG_SIZE.height,
        style: { ...cover, objectFit: 'cover' },
      },
    })
    // A dark wash, so white text stays readable over any photograph.
    layers.push(div({ ...cover, background: OVERLAY }))
  }

  const lines: unknown[] = [
    div({ fontSize: titleSize, lineHeight: 1.15, color: '#ffffff', letterSpacing: '-0.02em', display: 'flex' },
      card.title),
  ]
  if (card.desc) {
    lines.push(div({
      marginTop: 24, fontSize: 28, lineHeight: 1.4, color: 'rgba(255,255,255,0.82)',
      // Four lines, so a long excerpt cannot push the date off the card.
      display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
    }, card.desc))
  }
  const bottom = card.date || card.site
  if (bottom) {
    lines.push(div({ marginTop: 26, fontSize: 26, color: 'rgba(255,255,255,0.55)', display: 'flex' }, bottom))
  }
  layers.push(div({ display: 'flex', flexDirection: 'column', padding: 72, position: 'relative' }, lines))

  return div({
    width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
    justifyContent: 'flex-end', position: 'relative', background: GRADIENT, fontFamily: family,
  }, layers)
}

/** Render the card to PNG bytes. */
export async function renderOgCard(card: OgCard): Promise<Uint8Array> {
  const base = await interFonts()
  // The owner's face first, with the Inter subsets always behind it, so a glyph it lacks
  // still resolves. Same idea as the site's own font stack.
  const all = card.customFont
    ? [{ name: 'Site', data: card.customFont, weight: 600 as const, style: 'normal' as const }, ...base]
    : base
  const family = (card.customFont ? 'Site, ' : '') + 'Inter, InterExt, InterVN'

  const svg = await satori(tree(card, family) as never, { ...OG_SIZE, fonts: all })
  return new Uint8Array(await sharp(Buffer.from(svg)).png().toBuffer())
}
