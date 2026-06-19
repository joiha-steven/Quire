'use client'

// Custom image node: a figure with an editable caption and a width toggle
// (column / full-bleed). Width is encoded as a "#full" marker on the src and the
// caption is stored in the image's alt text, so the node still serializes to
// plain markdown (![caption](url#full)) via tiptap-markdown.
import Image from '@tiptap/extension-image'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useAdminT } from './I18nProvider'

function CaptionedImageView({ node, updateAttributes, selected }: NodeViewProps) {
  const t = useAdminT()
  const src = (node.attrs.src as string) || ''
  const caption = (node.attrs.alt as string) || ''
  const isFull = src.includes('#full')
  const cleanSrc = src.replace(/#full$/, '')

  const setFull = (full: boolean) => {
    const base = src.replace(/#full$/, '')
    updateAttributes({ src: full ? `${base}#full` : base })
  }

  const tab = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${
      active ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500'
    }`

  return (
    <NodeViewWrapper as="figure" className={`my-4 ${isFull ? 'img-full' : ''}`} data-drag-handle>
      {selected && (
        <div
          className="mb-2 inline-flex gap-1 rounded-lg bg-neutral-100 p-1 dark:bg-neutral-800"
          contentEditable={false}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button type="button" onClick={() => setFull(false)} className={tab(!isFull)}>
            {t.imgWidthColumn}
          </button>
          <button type="button" onClick={() => setFull(true)} className={tab(isFull)}>
            {t.imgWidthFull}
          </button>
        </div>
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cleanSrc} alt={caption} className={`w-full rounded-lg ${selected ? 'ring-2 ring-blue-400' : ''}`} />
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
