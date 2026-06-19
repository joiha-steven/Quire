'use client'

// Custom image node: a figure with an editable caption, alignment (left/center/
// right) and a "wide" toggle (30% past the column). Placement is encoded as a
// fragment on the src (e.g. ![caption](url#right-wide)) and the caption lives in
// the alt, so the node still serializes to plain Markdown via tiptap-markdown.
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useAdminT } from './I18nProvider'

type Align = 'left' | 'center' | 'right'

function parseFrag(src: string): { clean: string; align: Align; wide: boolean } {
  const [clean, frag = ''] = src.split('#')
  const align: Align = /left/.test(frag) ? 'left' : /right/.test(frag) ? 'right' : 'center'
  return { clean, align, wide: /wide/.test(frag) }
}
function buildSrc(clean: string, align: Align, wide: boolean): string {
  const marker = [align !== 'center' ? align : '', wide ? 'wide' : ''].filter(Boolean).join('-')
  return marker ? `${clean}#${marker}` : clean
}

function CaptionedImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const t = useAdminT()
  const src = (node.attrs.src as string) || ''
  const caption = (node.attrs.alt as string) || ''
  const { clean, align, wide } = parseFrag(src)

  const setAlign = (a: Align) => updateAttributes({ src: buildSrc(clean, a, wide) })
  const setWide = (w: boolean) => updateAttributes({ src: buildSrc(clean, align, w) })

  const figCls = `img-${align}${wide ? ' img-wide' : ''}`
  const btn = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${
      active ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500'
    }`

  return (
    <NodeViewWrapper as="figure" className={`my-4 ${figCls}`} data-drag-handle>
      {selected && (
        <div
          className="mb-2 flex flex-wrap gap-2"
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
        >
          <div className="inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
            <button type="button" onClick={() => setAlign('left')} className={btn(align === 'left')}>
              {t.imgAlignLeft}
            </button>
            <button type="button" onClick={() => setAlign('center')} className={btn(align === 'center')}>
              {t.imgAlignCenter}
            </button>
            <button type="button" onClick={() => setAlign('right')} className={btn(align === 'right')}>
              {t.imgAlignRight}
            </button>
          </div>
          <div className="inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800">
            <button type="button" onClick={() => setWide(false)} className={btn(!wide)}>
              {t.imgSizeColumn}
            </button>
            <button type="button" onClick={() => setWide(true)} className={btn(wide)}>
              {t.imgSizeWide}
            </button>
          </div>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={clean} alt={caption} className={`w-full rounded-lg ${selected ? 'ring-2 ring-blue-400' : ''}`} />
      <input
        value={caption}
        onChange={(e) => updateAttributes({ alt: e.target.value })}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder={t.captionPlaceholder}
        contentEditable={false}
        className="mt-1.5 w-full border-0 bg-transparent text-center text-sm text-neutral-500 outline-none placeholder:text-neutral-300 dark:text-neutral-400 dark:placeholder:text-neutral-600"
      />
    </NodeViewWrapper>
  )
}

export const CaptionedImage = Image.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CaptionedImageView)
  },
})
