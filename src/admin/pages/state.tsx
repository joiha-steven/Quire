// The three states a server component never had to render.
//
// Every page shell fetches now, so every page shell can be loading or broken. Giving them
// one shared pair means no page invents its own — and, more to the point, that none of
// them quietly render their component tree with empty props, which is how a client port
// ends up showing an empty table where the server showed a list.

import type { ReactNode } from 'react'
import type { ViewState } from '@/admin/useView'

export function Loading() {
  return <div className="py-16 text-center text-sm text-neutral-400 dark:text-neutral-500">…</div>
}

export function Failed({ error }: { error: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
      {error}
    </div>
  )
}

/** Render `children(data)` only once there IS data. */
export function View<T>({ state, children }: { state: ViewState<T>; children: (data: T) => ReactNode }) {
  if (state.error) return <Failed error={state.error} />
  if (!state.data) return <Loading />
  return <>{children(state.data)}</>
}
