'use client'

// Editor node for an embedded video. Stored in Markdown as a bare URL on its own
// line (so content stays 100% Markdown); shown here as a responsive embed. The
// public renderer turns the same URL into an iframe.
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { videoEmbed, videoFileUrl } from '@/lib/video'
import { useAdminT } from './I18nProvider'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: { setVideo: (src: string) => ReturnType }
  }
}

function VideoView({ node, updateAttributes, selected }: NodeViewProps) {
  const t = useAdminT()
  const raw = (node.attrs.src as string) || ''
  // A trailing `#wide` fragment sizes the player like a wide image; keep it out of URL
  // detection and re-attach it via the toggle, so the node still serializes to a bare URL.
  const [src, frag = ''] = raw.split('#')
  const wide = /wide/.test(frag)
  const v = videoEmbed(src)
  const file = v ? null : videoFileUrl(src)
  const setWide = (w: boolean) => updateAttributes({ src: w ? `${src}#wide` : src })
  const btn = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-xs font-medium ${
      active ? 'bg-white text-neutral-900 shadow-sm dark:bg-neutral-700 dark:text-white' : 'text-neutral-500'
    }`
  return (
    <NodeViewWrapper as="div" className="my-4" data-drag-handle>
      {selected && (v || file) && (
        <div className="mb-2 flex flex-wrap gap-2" contentEditable={false} onMouseDown={(e) => e.preventDefault()}>
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
      {v ? (
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
          <iframe src={v.embed} className="absolute inset-0 h-full w-full" allowFullScreen loading="lazy" />
        </div>
      ) : file ? (
        // Self-hosted video file (Library upload): native player, natural aspect —
        // mirrors the published .video-file rendering.
        <video src={file} controls preload="metadata" playsInline className="block w-full rounded-lg" />
      ) : (
        <p className="break-all text-sm text-neutral-500">{src}</p>
      )}
    </NodeViewWrapper>
  )
}

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return { src: { default: '' } }
  },
  parseHTML() {
    return [{ tag: 'div[data-video]', getAttrs: (el) => ({ src: (el as HTMLElement).getAttribute('data-src') || '' }) }]
  },
  renderHTML({ node }) {
    return ['div', { 'data-video': '', 'data-src': node.attrs.src }]
  },
  addNodeView() {
    return ReactNodeViewRenderer(VideoView)
  },
  addCommands() {
    return {
      setVideo:
        (src) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { src } }),
    }
  },
  addStorage() {
    return {
      markdown: {
        // Serialize back to a bare URL line.
        serialize(state: { write: (s: string) => void; closeBlock: (n: unknown) => void }, node: { attrs: { src: string } }) {
          state.write(node.attrs.src || '')
          state.closeBlock(node)
        },
        parse: {},
      },
    }
  },
})
