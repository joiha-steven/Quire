// The router, in place of `next/link` and `next/navigation`.
//
// The admin is one static bundle served under `/admin/*`, so routing is a listener on
// `popstate` plus `history.pushState`. That is the whole of what the ported components
// used Next's router for: a `<Link>`, the current path, the query string, and a
// programmatic push or refresh.
//
// `refresh()` is the one that needed thought. In Next it re-ran the server component and
// streamed fresh props in; here there is no server render, so it bumps a counter that the
// page shells depend on, which re-runs their fetch. Same effect, one concept fewer.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AnchorHTMLAttributes, ReactNode } from 'react'

type RouterState = {
  path: string
  search: string
  /** Bumped by `refresh()`. Page shells list it as a dependency of their data fetch. */
  epoch: number
}

type RouterApi = RouterState & {
  push: (href: string) => void
  replace: (href: string) => void
  back: () => void
  refresh: () => void
}

const RouterContext = createContext<RouterApi | null>(null)

const readLocation = (): { path: string; search: string } => ({
  path: location.pathname,
  search: location.search,
})

export function RouterProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RouterState>(() => ({ ...readLocation(), epoch: 0 }))

  useEffect(() => {
    const onPop = () => setState((s) => ({ ...readLocation(), epoch: s.epoch }))
    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
  }, [])

  const go = useCallback((href: string, mode: 'push' | 'replace') => {
    if (mode === 'push') history.pushState(null, '', href)
    else history.replaceState(null, '', href)
    setState((s) => ({ ...readLocation(), epoch: s.epoch }))
    // A new page starts at the top. The browser only does this for a real navigation.
    scrollTo(0, 0)
  }, [])

  const api = useMemo<RouterApi>(() => ({
    ...state,
    push: (href) => go(href, 'push'),
    replace: (href) => go(href, 'replace'),
    back: () => history.back(),
    refresh: () => setState((s) => ({ ...s, epoch: s.epoch + 1 })),
  }), [state, go])

  return <RouterContext.Provider value={api}>{children}</RouterContext.Provider>
}

function useRouterContext(): RouterApi {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used inside RouterProvider')
  return ctx
}

export const useRouter = useRouterContext
export const usePathname = (): string => useRouterContext().path

/**
 * A read-only `URLSearchParams` for the current query, matching the subset of Next's
 * hook the ported components actually call: `get`, `has` and `toString`.
 */
export function useSearchParams(): URLSearchParams {
  const { search } = useRouterContext()
  return useMemo(() => new URLSearchParams(search), [search])
}

/** The epoch a `refresh()` bumps. A page shell refetches when this changes. */
export const useRefreshEpoch = (): number => useRouterContext().epoch

type LinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
  children: ReactNode
  /** Accepted and ignored: Next prefetches, this bundle is already loaded. */
  prefetch?: boolean
  scroll?: boolean
  replace?: boolean
}

/**
 * An anchor that routes in place. A real `href` throughout, so middle-click, Ctrl-click
 * and "open in new tab" all keep working — which is why the modifier check below is not
 * optional. An external or non-admin href falls through to the browser.
 */
export function Link({ href, children, prefetch, scroll, replace, onClick, ...rest }: LinkProps) {
  const router = useRouterContext()
  void prefetch
  void scroll
  return (
    <a
      href={href}
      onClick={(e) => {
        onClick?.(e)
        if (e.defaultPrevented) return
        // Let the browser handle anything that is not a plain left click, and anything
        // that leaves the admin.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
        if (!href.startsWith('/') || href.startsWith('//')) return
        if (!href.startsWith('/admin')) return
        e.preventDefault()
        if (replace) router.replace(href)
        else router.push(href)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}

export default Link
