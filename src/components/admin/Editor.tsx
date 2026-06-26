'use client'

// TipTap markdown editor with a compact toolbar.
// Marks/nodes: bold, italic, underline, strike, inline code, H1-H5, bullet +
// numbered + task lists, quote, code block, horizontal rule, link, image
// (align + wide + grid gallery), GFM tables, and video (paste a YouTube/Vimeo/TikTok URL).
// Drag an image file in -> auto-uploads -> inserts at the drop point. A Markdown/Review
// toggle swaps the formatted view for the raw Markdown source.
import { useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent, type Editor as TiptapEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExt from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import { Table, TableRow, TableHeader, TableCell } from '@tiptap/extension-table'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Placeholder } from '@tiptap/extension-placeholder'
import { Markdown } from 'tiptap-markdown'
import { CaptionedImage } from './CaptionedImage'
import { Video } from './VideoNode'
import { isVideoUrl } from '@/lib/video'
import { useAdminT } from './I18nProvider'

export type EditorApi = {
  insertImage: (url: string) => void
  // Insert several images as gallery items (#grid) in ONE transaction —
  // consecutive #grid images group into a CSS grid on the public side. Must be a
  // single insert: setImage selects the node it inserts, so calling it in a loop
  // makes each image REPLACE the previous one (only the last survived).
  insertGalleryMany: (urls: string[]) => void
  // Serialize the current document to Markdown on demand (used at save time, so
  // a save always captures the latest text even mid-debounce).
  getMarkdown: () => string
  // Replace the whole document (used by the time machine to load a revision).
  setMarkdown: (md: string) => void
}

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

// After loading/parsing markdown, promote any paragraph that is just a video URL
// into a video node, so reloaded posts show the embed (not a bare link).
function videoUrlsToNodes(editor: TiptapEditor): void {
  const { state } = editor
  const videoType = state.schema.nodes.video
  if (!videoType) return
  const hits: { from: number; to: number; src: string }[] = []
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'paragraph') return
    const text = node.textContent.trim()
    if (text && !/\s/.test(text) && isVideoUrl(text)) hits.push({ from: pos, to: pos + node.nodeSize, src: text })
  })
  if (!hits.length) return
  let tr = state.tr
  hits.reverse().forEach(({ from, to, src }) => {
    tr = tr.replaceWith(from, to, videoType.create({ src }))
  })
  editor.view.dispatch(tr)
}

type Props = {
  initialContent: string
  // Latest Markdown, pushed on a trailing debounce (keeps fast typing smooth).
  onChange: (markdown: string) => void
  // Fired immediately on every edit. Cheap: lets the parent flag "unsaved" without
  // serializing the whole document on each keystroke.
  onDirty: () => void
  onPickImage: () => void
  onPickGallery: () => void
  onUploadFile: (file: File) => Promise<string | null>
  apiRef: React.MutableRefObject<EditorApi | null>
  // Width of the public single-post column, so typing mirrors the live layout.
  contentWidth: number
}

const BTN = 'rounded px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800'

function Toolbar({
  editor,
  onPickImage,
  onPickGallery,
  raw,
  onToggleRaw,
}: {
  editor: TiptapEditor
  onPickImage: () => void
  onPickGallery: () => void
  raw: boolean
  onToggleRaw: () => void
}) {
  const t = useAdminT()
  const cls = (active: boolean) => `${BTN} ${active ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white' : 'text-neutral-600'}`
  const sep = <span className="mx-1 h-5 w-px bg-neutral-200" />
  // Markdown/Review toggle. Kept INLINE (no ml-auto) so it trails the other
  // buttons instead of being pushed to the right edge — where it wrapped onto a
  // lonely second row and looked broken.
  const toggle = (
    <button type="button" onClick={onToggleRaw} className={`${BTN} font-medium text-neutral-600`}>
      {raw ? t.tbReview : t.tbMarkdown}
    </button>
  )
  // In Markdown source mode the formatting buttons don't apply to plain text.
  if (raw) {
    return (
      <div className="sticky top-0 z-10 flex items-center rounded-t-xl border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
        {toggle}
      </div>
    )
  }
  // Wrap to a second row when the buttons don't fit — a horizontal scrollbar here
  // fights the browser's own scrollbar, so wrapping is the lesser evil.
  return (
    <div className="sticky top-0 z-10 rounded-t-xl border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex flex-wrap items-center gap-0.5">
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
      <button type="button" onClick={() => editor.chain().focus().toggleCode().run()} className={cls(editor.isActive('code'))}>
        <code className="">{'`'}</code>
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
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className={cls(editor.isActive('heading', { level: 4 }))}>
        H4
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} className={cls(editor.isActive('heading', { level: 5 }))}>
        H5
      </button>
      {sep}
      <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={cls(editor.isActive('bulletList'))}>
        • {t.tbList}
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={cls(editor.isActive('orderedList'))}>
        1. {t.tbListNumbered}
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleTaskList().run()} className={cls(editor.isActive('taskList'))}>
        ☑ {t.tbTask}
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={cls(editor.isActive('blockquote'))}>
        ❝ {t.tbQuote}
      </button>
      <button type="button" onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={cls(editor.isActive('codeBlock'))}>
        {'</>'} {t.tbCodeBlock}
      </button>
      <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={cls(false)}>
        ― {t.tbDivider}
      </button>
      {sep}
      <button
        type="button"
        onClick={() => {
          // Prefill the existing href so an old link can be edited (not just
          // created). extendMarkRange covers the whole link when the cursor is
          // merely inside it — no need to first select the linked text.
          const prev = (editor.getAttributes('link').href as string | undefined) ?? ''
          const url = window.prompt(t.promptLink, prev)
          if (url === null) return // cancelled — leave the link untouched
          const range = editor.chain().focus().extendMarkRange('link')
          if (url === '') range.unsetLink().run() // cleared the URL -> remove the link
          else range.setLink({ href: url }).run()
        }}
        className={cls(editor.isActive('link'))}
      >
        {t.tbLink}
      </button>
      <button type="button" onClick={onPickImage} className={cls(false)}>
        {t.tbImage}
      </button>
      <button type="button" onClick={onPickGallery} className={cls(false)}>
        {t.tbGallery}
      </button>
      <button
        type="button"
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        className={cls(false)}
      >
        {t.tbTable}
      </button>
      {sep}
      {toggle}
      </div>
      {/* Table controls appear only with the cursor inside a table — that's the
          only place add-column / add-row apply (insertTable alone gave a fixed
          3×3 with no way to grow it). */}
      {editor.isActive('table') && (
        <div className="mt-1.5 flex flex-wrap items-center gap-0.5 border-t border-neutral-100 pt-1.5 dark:border-neutral-800">
          <span className="px-1 text-xs font-medium text-neutral-400">{t.tbTableTools}</span>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className={cls(false)}>{t.tbColAdd}</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className={cls(false)}>{t.tbColDel}</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className={cls(false)}>{t.tbRowAdd}</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className={cls(false)}>{t.tbRowDel}</button>
          {sep}
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className={cls(false)}>{t.tbTableDelete}</button>
        </div>
      )}
    </div>
  )
}

export function Editor({ initialContent, onChange, onDirty, onPickImage, onPickGallery, onUploadFile, apiRef, contentWidth }: Props) {
  const t = useAdminT()
  // Markdown source view: edit the raw markdown directly (still saves live).
  const [raw, setRaw] = useState(false)
  const [rawText, setRawText] = useState('')
  // Refs so getMarkdown / the debounce read live values without re-subscribing.
  const onChangeRef = useRef(onChange)
  const onDirtyRef = useRef(onDirty)
  const rawRef = useRef(raw)
  const rawTextRef = useRef(rawText)
  const flushTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // The editorProps closures below are created once (on the first useEditor call,
  // when `editor` is still null). Reading the live instance through a ref instead
  // of the captured `editor` const is what makes drag-drop insert reliably —
  // otherwise the dropped image only appeared when the stale closure happened to
  // hold a non-null editor ("lúc ăn lúc không").
  const editorRef = useRef<TiptapEditor | null>(null)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  useEffect(() => { onDirtyRef.current = onDirty }, [onDirty])
  useEffect(() => { rawRef.current = raw }, [raw])
  useEffect(() => { rawTextRef.current = rawText }, [rawText])

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Underline,
      LinkExt.configure({ openOnClick: false }),
      CaptionedImage,
      Video,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      // GFM task lists (- [ ] / - [x]); marked renders them on the public side.
      TaskList,
      TaskItem.configure({ nested: true }),
      // Per-block placeholder (adds the is-editor-empty class + data-placeholder
      // the CSS reads). The old root data-placeholder attribute rendered nothing.
      Placeholder.configure({ placeholder: t.editorPlaceholder }),
      // html:false -> raw HTML in the source is treated as plain text, never
      // parsed into nodes. Keeps the blog 100% Markdown.
      Markdown.configure({ html: false }),
    ],
    content: initialContent,
    editorProps: {
      attributes: { class: 'prose max-w-none min-h-[420px] px-4 py-4' },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith('image/'))
        if (files.length === 0) return false
        event.preventDefault()
        // Capture WHERE the image was dropped now — uploads are async, so by the
        // time they resolve the text cursor has wandered (the image used to land
        // at the stale cursor, i.e. the end of the post). Insert at the drop point.
        let pos = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        // Upload sequentially so multiple dropped images insert in order.
        ;(async () => {
          for (const file of files) {
            const url = await onUploadFile(file)
            const ed = editorRef.current
            if (!url || !ed) continue
            const alt = file.name.replace(/\.[a-z0-9]+$/i, '')
            const chain = pos == null ? ed.chain().focus() : ed.chain().focus(pos)
            chain.setImage({ src: url, alt }).run()
            // Advance past the just-inserted image so the next one lands after it.
            pos = ed.state.selection.to
          }
        })()
        return true
      },
      // Paste a lone video URL (YouTube/Vimeo/TikTok) -> insert a video embed.
      handlePaste(view, event) {
        const text = event.clipboardData?.getData('text/plain')?.trim() ?? ''
        if (text && !/\s/.test(text) && isVideoUrl(text)) {
          editorRef.current?.chain().focus().setVideo(text).run()
          return true
        }
        return false
      },
    },
    onCreate({ editor }) {
      videoUrlsToNodes(editor)
    },
    onUpdate({ editor }) {
      // Per-keystroke work is kept tiny: flag dirty now, serialize the whole
      // document to Markdown on a trailing debounce so typing never stutters.
      onDirtyRef.current()
      if (flushTimer.current) clearTimeout(flushTimer.current)
      flushTimer.current = setTimeout(() => onChangeRef.current(readMarkdown(editor)), 400)
    },
  })

  const taRef = useRef<HTMLTextAreaElement>(null)
  // Grow the Markdown source box to fit its content (no tiny inner scrollbox).
  useEffect(() => {
    const ta = taRef.current
    if (raw && ta) {
      ta.style.height = 'auto'
      ta.style.height = `${ta.scrollHeight}px`
    }
  }, [raw, rawText])

  useEffect(() => {
    if (!editor) return
    editorRef.current = editor // keep the drag-drop / paste closures on the live instance
    apiRef.current = {
      insertImage: (url: string) =>
        editor.chain().focus().setImage({ src: url, alt: captionFromUrl(url) }).run(),
      // Gallery: empty alt for a clean mosaic; '#grid' groups consecutive ones.
      // One insertContent of an array keeps all images (a per-image loop would
      // leave only the last — each setImage replaces the selected prior node).
      insertGalleryMany: (urls: string[]) => {
        if (urls.length === 0) return
        const nodes = urls.map((url) => ({ type: 'image', attrs: { src: `${url}#grid`, alt: '' } }))
        editor.chain().focus().insertContent(nodes).run()
      },
      // In raw mode the textarea is the source of truth; otherwise serialize live.
      getMarkdown: () => (rawRef.current ? rawTextRef.current : readMarkdown(editor)),
      // Load a full document, leaving raw mode so the formatted view shows it.
      setMarkdown: (md: string) => {
        editor.commands.setContent(md)
        videoUrlsToNodes(editor)
        setRawText(md)
        setRaw(false)
      },
    }
  }, [editor, apiRef])

  // Drop any pending debounce when the editor unmounts.
  useEffect(() => () => { if (flushTimer.current) clearTimeout(flushTimer.current) }, [])

  if (!editor) return <div className="min-h-[480px] animate-pulse bg-neutral-50 dark:bg-neutral-900" />

  // Review -> Markdown: snapshot the current markdown. Markdown -> Review:
  // re-parse the (possibly edited) markdown back into the formatted editor.
  function toggleRaw() {
    if (!editor) return
    if (raw) {
      editor.commands.setContent(rawText)
      videoUrlsToNodes(editor)
      onChange(rawText)
      setRaw(false)
    } else {
      setRawText(readMarkdown(editor))
      setRaw(true)
    }
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <Toolbar editor={editor} onPickImage={onPickImage} onPickGallery={onPickGallery} raw={raw} onToggleRaw={toggleRaw} />
      {/* Center the writing column at the public single-post width so what you
          type wraps exactly like the published article. */}
      <div className="mx-auto w-full" style={{ maxWidth: contentWidth }}>
        {raw ? (
          <textarea
            ref={taRef}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value)
              onDirty()
              onChange(e.target.value)
            }}
            spellCheck={false}
            className="min-h-[60vh] w-full resize-none overflow-hidden bg-transparent px-4 py-4 text-sm leading-relaxed text-neutral-800 outline-none dark:text-neutral-200"
          />
        ) : (
          <EditorContent editor={editor} />
        )}
      </div>
    </div>
  )
}
