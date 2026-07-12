'use client'

// Editor menus, split out of Editor.tsx to keep it under the size cap:
//  - Toolbar: the sticky top bar (formatting + a contextual table-tools row).
//  - BubbleBar: a floating menu that pops up on a text selection or with the
//    cursor inside a link — formatting + quick link edit/remove, like other
//    modern editors.
// Both need the editor to re-render on selection change; Editor.tsx enables
// `shouldRerenderOnTransaction` so isActive() stays live (off by default in
// TipTap 3, which is why the table row / active highlights weren't updating).
import React, { useCallback, useMemo } from 'react'
import { type Editor as TiptapEditor } from '@tiptap/react'
import { BubbleMenu } from '@tiptap/react/menus'
import { NodeSelection, type EditorState } from '@tiptap/pm/state'
import { useAdminT } from './I18nProvider'

const BTN = 'rounded px-2 py-1 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800'

export function Toolbar({
  editor,
  onPickImage,
  onPickGallery,
  raw,
  onToggleRaw,
  stickyTop,
}: {
  editor: TiptapEditor
  onPickImage: () => void
  onPickGallery: () => void
  raw: boolean
  onToggleRaw: () => void
  stickyTop: number
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
      <div className="sticky z-10 flex items-center border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900" style={{ top: stickyTop }}>
        {toggle}
      </div>
    )
  }
  // Wrap to a second row when the buttons don't fit — a horizontal scrollbar here
  // fights the browser's own scrollbar, so wrapping is the lesser evil.
  return (
    <div className="sticky z-10 border-b border-neutral-200 bg-white p-2 dark:border-neutral-800 dark:bg-neutral-900" style={{ top: stickyTop }}>
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
      <button type="button" onClick={() => editor.chain().focus().setParagraph().run()} className={cls(editor.isActive('paragraph'))}>P</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={cls(editor.isActive('heading', { level: 1 }))}>H1</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={cls(editor.isActive('heading', { level: 2 }))}>H2</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={cls(editor.isActive('heading', { level: 3 }))}>H3</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} className={cls(editor.isActive('heading', { level: 4 }))}>H4</button>
      <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} className={cls(editor.isActive('heading', { level: 5 }))}>H5</button>
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

// Floating menu over a text selection (or with the cursor in a link). An
// elevated chip that follows light/dark like the toolbar (a fixed dark chip was
// too harsh on light, and vanished into the dark editor background).
export function BubbleBar({ editor }: { editor: TiptapEditor }) {
  const t = useAdminT()
  const cls = (active: boolean) =>
    `rounded px-2 py-1 text-sm ${active ? 'bg-neutral-200 text-neutral-900 dark:bg-neutral-700 dark:text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-700'}`
  // Keep the selection while clicking (mousedown would otherwise blur the editor
  // and collapse it before the command runs).
  const hold = (e: React.MouseEvent) => e.preventDefault()
  const editLink = () => {
    const prev = (editor.getAttributes('link').href as string | undefined) ?? ''
    const url = window.prompt(t.promptLink, prev)
    if (url === null) return
    const range = editor.chain().focus().extendMarkRange('link')
    if (url === '') range.unsetLink().run()
    else range.setLink({ href: url }).run()
  }
  // These two MUST be referentially stable. BubbleMenu re-dispatches an
  // "updateOptions" transaction whenever `options`/`shouldShow` change identity;
  // with shouldRerenderOnTransaction on, a fresh inline object each render would
  // loop (dispatch -> re-render -> new object -> dispatch -> ...) and crash.
  const options = useMemo(() => ({ placement: 'top' as const, offset: 8 }), [])
  const shouldShow = useCallback(
    ({ editor: ed, state, from, to }: { editor: TiptapEditor; state: EditorState; from: number; to: number }) => {
      if (ed.isActive('link')) return true // cursor in a link -> offer edit/remove
      if (from === to) return false // nothing selected
      // A node selection (image / video) carries its own controls — don't cover it.
      if (state.selection instanceof NodeSelection) return false
      return true
    },
    [],
  )
  return (
    <BubbleMenu
      editor={editor}
      options={options}
      shouldShow={shouldShow}
      className="flex items-center gap-0.5 rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-800"
    >
      <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().toggleBold().run()} className={cls(editor.isActive('bold'))}><strong>B</strong></button>
      <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().toggleItalic().run()} className={cls(editor.isActive('italic'))}><em>I</em></button>
      <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().toggleUnderline().run()} className={cls(editor.isActive('underline'))}><u>U</u></button>
      <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().toggleStrike().run()} className={cls(editor.isActive('strike'))}><s>S</s></button>
      <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().toggleCode().run()} className={cls(editor.isActive('code'))}><code>{'`'}</code></button>
      <span className="mx-0.5 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />
      <button type="button" onMouseDown={hold} onClick={editLink} className={cls(editor.isActive('link'))}>{t.tbLink}</button>
      {editor.isActive('link') && (
        <button type="button" onMouseDown={hold} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()} className={cls(false)}>{t.tbLinkRemove}</button>
      )}
    </BubbleMenu>
  )
}
