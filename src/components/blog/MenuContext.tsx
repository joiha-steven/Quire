'use client'

// On narrow screens the sidebar has no gutter to live in, so its contents move
// into the header menu. Categories/tags are site-wide and come straight from the
// layout, but a post's table of contents is known only to the post page — which
// renders BELOW the header. This context carries the headings back up.
import { createContext, useContext, useEffect, useState } from 'react'
import type { Heading } from '@/lib/utils'

type Ctx = {
  headings: Heading[]
  setHeadings: (h: Heading[]) => void
}

const MenuCtx = createContext<Ctx>({ headings: [], setHeadings: () => {} })

export function MenuProvider({ children }: { children: React.ReactNode }) {
  const [headings, setHeadings] = useState<Heading[]>([])
  return <MenuCtx.Provider value={{ headings, setHeadings }}>{children}</MenuCtx.Provider>
}

export function useMenuHeadings() {
  return useContext(MenuCtx).headings
}

// Rendered by the post page. Publishes its headings to the header menu and clears
// them on unmount, so navigating to a list page leaves no stale table of contents.
export function SetMenuHeadings({ headings }: { headings: Heading[] }) {
  const { setHeadings } = useContext(MenuCtx)
  useEffect(() => {
    setHeadings(headings)
    return () => setHeadings([])
  }, [headings, setHeadings])
  return null
}
