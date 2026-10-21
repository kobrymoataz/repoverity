import { useCallback, useEffect, useRef, useState } from 'react'
import type { GitHubSnapshot } from '../types/github'
import { appendRepositoryPage, fetchRepositoryPage, firstRepositoryPage } from '../lib/repositoryPages'

/** Scoped to the current profile snapshot. Switching profiles aborts any in-flight page. */
export function useRepositoryPages(snapshot: GitHubSnapshot) {
  const [pageState, setPageState] = useState(() => firstRepositoryPage(snapshot.repositories))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const lock = useRef(false)

  useEffect(() => {
    return () => { controller.current?.abort(); lock.current = false }
  }, [])

  const loadNext = useCallback(async () => {
    if (lock.current || !pageState.hasMore || pageState.nextPage > 100) return
    lock.current = true
    const next = new AbortController()
    controller.current = next
    setLoading(true)
    setError(null)
    try {
      const data = await fetchRepositoryPage(snapshot.user.login, pageState.nextPage, next.signal)
      if (!next.signal.aborted) setPageState(previous => appendRepositoryPage(previous, data))
    } catch (cause) {
      if (!next.signal.aborted) setError(cause instanceof Error ? cause.message : 'Repository request failed.')
    } finally {
      if (!next.signal.aborted) { setLoading(false); lock.current = false }
    }
  }, [snapshot.user.login, pageState.hasMore, pageState.nextPage])

  const capped = pageState.nextPage > 100
  return { ...pageState, hasMore: pageState.hasMore && !capped, loading, error,
    loadNext, capped }
}
