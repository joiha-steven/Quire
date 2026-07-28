// The visible post hero. The cover is the post's LCP image, so it should be served
// responsively like body images — a <picture> with AVIF/WebP @1024/1600 — instead of
// shipping the full-size original. Only jpg/png originals whose variants exist get the
// <picture> (a <picture> has no fallback on a 404 source); everything else stays a plain
// <img>. `aspect-video` + `object-cover` reserve the box (no CLS); rounded like the rest.
import { collapseBlob } from '@/lib/blob'

const SIZES = '(max-width: 768px) 100vw, 768px'
const CLASS = 'mt-8 aspect-video w-full rounded-lg object-cover'

export function CoverImage({ src, ready }: { src: string; ready: Set<string> }) {
  // eslint-disable-next-line @next/next/no-img-element
  const img = <img src={src} alt="" className={CLASS} fetchPriority="high" />
  const m = src.match(/^(.*\/media\/.+)\.(?:jpe?g|png)$/i)
  if (!m || !ready.has(collapseBlob(src))) return img
  const set = (fmt: string) => `${m[1]}-1024.${fmt} 1024w, ${m[1]}-1600.${fmt} 1600w`
  return (
    // display:contents so the <img> keeps laying out exactly as before.
    <picture className="contents">
      <source type="image/avif" srcSet={set('avif')} sizes={SIZES} />
      <source type="image/webp" srcSet={set('webp')} sizes={SIZES} />
      {img}
    </picture>
  )
}
