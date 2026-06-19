'use client'

// TipTap markdown editor with a compact toolbar.
// - Toolbar: bold, italic, heading, list, blockquote, code, link, image.
// - Drag an image file into the editor -> auto-uploads -> inserts at cursor.
// Parent owns the markdown via onChange and can insert images through `apiRef`.
import { useEffect } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExt from '@tiptap/extension-link'
import ImageExt from '@tiptap/extension-image'
import { Markdown } from 'tiptap-markdown'

export type EditorApi = { insertImage: (url: string) => void }

// tiptap-markdown augments storage at runtime but ships no type for it.
type MarkdownStorage = { markdown: { getMarkdown: () => string } }
function readMarkdown(editor: TiptapEditor): string {
  return (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown()
}

type Props = {
  initialContent: string
  onChange: (markdown: string) => void
  onPickImage: () => void
  onUploadFile: (file: File) => Promise<string | null>
  apiRef: React.MutableRefObject<EditorApi | null>
}

const BTN = 'rounded px-2 py-1 text-sm hover:bg-neutral-100'
const ACTIVE = 'bg-neutral-200 text-neutral-900'

function Toolbar({
  editor,
  onPickImage,
}: {
  editor: TiptapEditor
  onPickImage: () => void
}) {
  const cls = (active: boolean) => `${BTN} ${active ? ACTIVE : 'text-neutral-600'}`
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-neutral-200 p-2">
      <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={cls(editor.isActive('bold'))}>
        <strong>B</strong>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={cls(editor.isActive('italic'))}>
        <em>I</em>
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cls(editor.isActive('heading', { level: 2 }))}>
        H2
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cls(editor.isActive('heading', { level: 3 }))}>
        H3
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cls(editor.isActive('bulletList'))}>
        • Danh sách
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cls(editor.isActive('blockquote'))}>
        ❝
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={cls(editor.isActive('code'))}>
        {'</>'}
      </button>
      <button
        type="button"
        onClick={() => {
          const url = window.prompt('Nhập đường dẫn liên kết:')
          if (url) editor.chain().focus().setLink({ href: url }).run()
        }}
        className={cls(editor.isActive('link'))}
      >
        Liên kết
      </button>
      <button type="button" onClick={onPickImage} className={cls(false)}>
        Ảnh
      </button>
    </div>
  )
}

export function Editor({ initialContent, onChange, onPickImage, onUploadFile, apiRef }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      LinkExt.configure({ openOnClick: false }),
      ImageExt,
      Markdown.configure({ html: false }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: 'prose max-w-none min-h-[420px] px-4 py-4', 'data-placeholder': 'Bắt đầu viết...' },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return false
        event.preventDefault()
        files.forEach(async (file) => {
          const url = await onUploadFile(file)
          if (url) editor?.chain().focus().setImage({ src: url }).run()
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
      insertImage: (url: string) => editor.chain().focus().setImage({ src: url }).run(),
    }
  }, [editor, apiRef])

  if (!editor) return <div className="min-h-[480px] animate-pulse bg-neutral-50" />

  return (
    <div className="rounded-xl border border-neutral-200 bg-white">
      <Toolbar editor={editor} onPickImage={onPickImage} />
      <EditorContent editor={editor} />
    </div>
  )
}
