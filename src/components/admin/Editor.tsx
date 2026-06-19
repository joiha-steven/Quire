'use client'

// TipTap markdown editor with a compact toolbar.
// Marks/nodes: bold, italic, underline, strike, H1-H3, list, quote, code, link,
// image (+ per-image full-width toggle), and embedded video (YouTube).
// Drag an image file into the editor -> auto-uploads -> inserts at cursor.
// Parent owns the markdown via onChange and can insert images through `apiRef`.
import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExt from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Youtube from '@tiptap/extension-youtube'
import { Markdown } from 'tiptap-markdown'
import { CaptionedImage } from './CaptionedImage'
import { useAdminT } from './I18nProvider'

export type EditorApi = { insertImage: (url: string) => void }

// tiptap-markdown augments storage at runtime but ships no type for it.
type MarkdownStorage = { markdown: { getMarkdown: () => string } }
function readMarkdown(editor: TiptapEditor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown()
}

// Default caption from a media URL: the file name without its upload-timestamp
// prefix or extension (e.g. ".../1781-my-photo.jpg" -> "my-photo").
function captionFromUrl(url: string): string {
  const base = decodeURIComponent(url.split('/').pop() ?? '').replace(/[#?].*$/, '')
  return base.replace(/^\d+-/, '').replace(/\.[a-z0-9]+$/i, '')
}

type Props = {
  initialContent: string
  onChange: (markdown: string) => void
  onPickImage: () => void
  onUploadFile: (file: File) => Promise<string | null>
  apiRef: React.MutableRefObject<EditorApi | null>
}

const BTN = 'rounded px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800'

function Toolbar({ editor, onPickImage }: { editor: TiptapEditor; onPickImage: () => void }) {
  const t = useAdminT()
  const cls = (active: boolean) => `${BTN} ${active ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white' : 'text-neutral-600'}`
  const sep = <span className="mx-1 h-5 w-px bg-neutral-200" />
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 p-2 dark:border-neutral-800">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={cls(editor.isActive('bold'))}>
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={cls(editor.isActive('italic'))}>
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={cls(editor.isActive('underline'))}>
        <u>U</u>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={cls(editor.isActive('strike'))}>
        <s>S</s>
      </button>
      {sep}
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cls(editor.isActive('heading', { level: 1 }))}>
        H1
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cls(editor.isActive('heading', { level: 2 }))}>
        H2
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cls(editor.isActive('heading', { level: 3 }))}>
        H3
      </button>
      {sep}
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cls(editor.isActive('bulletList'))}>
        • {t.tbList}
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cls(editor.isActive('blockquote'))}>
        ❝
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={cls(editor.isActive('code'))}>
        {'</>'}
      </button>
      {sep}
      <button
        type="button"
        onClick={() => {
          const url = window.prompt(t.promptLink)
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        className={cls(editor.isActive('link'))}
      >
        {t.tbLink}
      </button>
      <button type="button" onClick={onPickImage} className={cls(false)}>
        {t.tbImage}
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt(t.promptVideo)
          if (url) editor.commands.setYoutubeVideo({ src: url })
        }}
        className={cls(false)}
      >
        {t.tbVideo}
      </button>
    </div>
  )
}

export function Editor({ initialContent, onChange, onPickImage, onUploadFile, apiRef }: Props) {
  const t = useAdminT()
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      LinkExt.configure({ openOnClick: false }),
      CaptionedImage,
      Youtube.configure({ width: 640, height: 360, nocookie: true }),
      Markdown.configure({ html: true }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: 'prose max-w-none min-h-[420px] px-4 py-4', 'data-placeholder': t.editorPlaceholder },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return false
        event.preventDefault()
        files.forEach(async (file) => {
          const url = await onUploadFile(file)
          if (url) {
            const alt = file.name.replace(/\.[a-z0-9]+$/i, '')
            editor?.chain().focus().setImage({ src: url, alt }).run()
          }
        })
        return true
      },
    },
    onUpdate({ editor }) {
      onChange(readMarkdown(editor))
    },
  })

  useEffect(() => {
    if (!editor) return
    apiRef.current = {
      insertImage: (url: string) =>
        editor.chain().focus().setImage({ src: url, alt: captionFromUrl(url) }).run(),
    }
  }, [editor, apiRef])

  if (!editor) return <div className="min-h-[480px] animate-pulse bg-neutral-50 dark:bg-neutral-900" />

  return (
    <div className="rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
      <Toolbar editor={editor} onPickImage={onPickImage} />
      <EditorContent editor={editor} />
    </div>
  )
}
