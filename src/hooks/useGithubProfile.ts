import { useCallback, useEffect, useState } from 'react'
import { getCachedSnapshot, GithubApiError } from '../lib/github'
import type { GitHubSnapshot } from '../types/github'

type Status = 'loading' | 'success' | 'error'

function getDefaultUsername(): string {
  const params = new URLSearchParams(window.location.search)
  return params.get('user') || 'kobrymoataz'
}

export function useGithubProfile() {
  const [username, setUsername] = useState(getDefaultUsername)
  const [status, setStatus] = useState<Status>('loading')
  const [snapshot, setSnapshot] = useState<GitHubSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError(null)
    getCachedSnapshot(username, controller.signal, requestId > 0)
      .then(data => {
        if (controller.signal.aborted) return
        setSnapshot(data)
        setStatus('success')
      })
      .catch(reason => {
        if (controller.signal.aborted) return
        setSnapshot(null)
        setError(reason instanceof GithubApiError ? reason.message : 'Something went wrong. Try again.')
        setStatus('error')
      })
    return () => controller.abort()
  }, [username, requestId])

  const analyze = useCallback((nextUsername: string) => {
    const clean = nextUsername.trim()
    if (!clean) return
    setUsername(clean)
    setRequestId(i => i + 1)
    const params = new URLSearchParams(window.location.search)
    params.set('user', clean)
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}${window.location.hash}`)
  }, [])

  const retry = useCallback(() => setRequestId(i => i + 1), [])

  return { username, status, snapshot, error, analyze, retry }
}
