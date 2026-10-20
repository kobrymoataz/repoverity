import { useCallback, useEffect, useMemo, useState } from 'react'
import type { GitHubSnapshot } from '../types/github'
import {
  emptyGrowthStore, getGrowthProfile, GROWTH_STORAGE_KEY, MAX_TRACKED_PROFILES, parseGrowthStore,
  pointFromSnapshot, recordGrowthPoint, removeGrowthHistory, setFollowerGoal,
  setGrowthTracking,
} from '../lib/growth'

function initialStore() {
  try {
    return parseGrowthStore(window.localStorage.getItem(GROWTH_STORAGE_KEY))
  } catch {
    return emptyGrowthStore()
  }
}

export function useGrowthHistory(snapshot: GitHubSnapshot | null, isLoaded: boolean) {
  const [store, setStore] = useState(initialStore)
  const [storageError, setStorageError] = useState(false)
  const login = snapshot?.user.login ?? null
  const profile = useMemo(() => getGrowthProfile(store, login ?? ''), [store, login])
  const enabled = profile.enabled
  const limitReached = Boolean(login && !store.profiles[login.toLowerCase()]
    && Object.keys(store.profiles).length >= MAX_TRACKED_PROFILES)

  useEffect(() => {
    try {
      window.localStorage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(store))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [store])

  useEffect(() => {
    if (!isLoaded || !snapshot || !enabled) return
    const point = pointFromSnapshot(snapshot)
    setStore(current => recordGrowthPoint(current, snapshot.user.login, point))
  }, [isLoaded, snapshot, enabled])

  const toggleTracking = useCallback(() => {
    if (!login) return
    setStore(current => setGrowthTracking(current, login, !getGrowthProfile(current, login).enabled))
  }, [login])

  const updateGoal = useCallback((goal: number) => {
    if (!login) return
    setStore(current => setFollowerGoal(current, login, goal))
  }, [login])

  const clearHistory = useCallback(() => {
    if (!login) return
    setStore(current => removeGrowthHistory(current, login))
  }, [login])

  return { profile, enabled, storageError, limitReached, toggleTracking, updateGoal, clearHistory }
}
