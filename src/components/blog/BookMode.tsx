'use client'

// Book-mode entry point: the tiny always-present piece — the "Chế độ đọc sách" toggle on the
// post meta line + the `#read` hash wiring. The heavy overlay (BookReader) is loaded LAZILY
// via next/dynamic, so its pagination code reaches the browser only when a reader opens book
// mode. This module is imported ONLY by the post route, so listings never bundle any of it.
// The stylesheet lives here (not in BookReader) so the toggle is styled + hidden-on-mobile
// from first paint, before the reader chunk loads.
import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import type { SiteLang } from '@/types'
import { t } from '@/lib/i18n'
import './book.css'

const BookReader = dynamic(() => import('./BookReader').then((m) => m.BookReader), { ssr: false })

export function BookMode({ title, lang }: { title: string; lang: SiteLang }) {
  const tx = t(lang)
  const [open, setOpen] = useState(false)
  // `#read` drives the reader, so it's a real, shareable link: /slug#read opens book mode on
  // load, the toggle is a plain <a href="#read">, and Back closes it (the hash leaves history).
  useEffect(() => {
    const sync = () => setOpen(window.location.hash === '#read')
    sync()
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])
  const close = useCallback(() => {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    setOpen(false)
  }, [])
  return (
    <>
      <a className="book-mode-toggle" href="#read">
        {tx.bookMode}
      </a>
      {open && <BookReader title={title} tx={tx} onClose={close} />}
    </>
  )
}
