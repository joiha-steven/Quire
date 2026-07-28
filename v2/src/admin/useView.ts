// The data hook every admin page shell uses.
//
// It stands in for what a Next server component did for free: fetch this page's props
// before rendering it. The three states it exposes — loading, error, data — are the three
// a server component never had to think about, and skipping any of them is how a client
// port ends up showing an empty table where the server showed a list.
//
// It refetches when `router.refresh()` bumps the epoch, so the ported components' existing
// `router.refresh()` calls after a save keep working unchanged.

import { useCallback, useEffect, useState } from 'react'
import { view } from '@/admin/api'
import { useRefreshEpoch } from '@/admin/router'

export type ViewState<T> = {
  data: T | null
  error: string | null
  loading: boolean
  /** Refetch without going through the router, for a component that owns its own reload. */
  reload: () => void
}

export function useView<T>(name: string, query = ''): ViewState<T> {
  const epoch = useRefreshEpoch()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let live = true
    setLoading(true)
    setError(null)
    view<T>(name, query)
      .then((d) => { if (live) setData(d) })
      .catch((e: Error) => { if (live) setError(e.message) })
      .finally(() => { if (live) setLoading(false) })
    // A page the reader has already navigated away from must not write its result into
    // state: the next page is mounted by then and would flash the previous one's data.
    return () => { live = false }
  }, [name, query, epoch, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload }
}
