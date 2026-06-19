'use client'

// Editor node for an embedded video. Stored in Markdown as a bare URL on its own
// line (so content stays 100% Markdown); shown here as a responsive embed. The
// public renderer turns the same URL into an iframe.
import { Node } from '@tiptap/core'
import { ReactNodeViewRenderer, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { videoEmbed } from '@/lib/video'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: { setVideo: (src: string) => ReturnType }
  }
}

function VideoView({ node }: NodeViewProps) {
  const src = (node.attrs.src as string) || ''
  const v = videoEmbed(src)
  return (
    <NodeViewWrapper as="div" className="my-4" data-drag-handle>
      {v ? (
        <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: '16 / 9' }}>
          <iframe src={v.embed} className="absolute inset-0 h-full w-full" allowFullScreen loading="lazy" />
        </div>
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
