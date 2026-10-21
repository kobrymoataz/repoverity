import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ACHIEVEMENT_STORAGE_KEY, achievementSummary, emptyAchievementTracker,
  getAchievementState, parseAchievementTracker, updateAchievementState,
  type AchievementId, type AchievementState,
} from '../lib/achievements'

function load() {
  if (typeof window === 'undefined') return emptyAchievementTracker()
  try {
    return parseAchievementTracker(window.localStorage.getItem(ACHIEVEMENT_STORAGE_KEY))
  } catch {
    return emptyAchievementTracker()
  }
}

/** A local checklist, not a GitHub-issued achievement verification system. */
export function useAchievementTracker(username: string) {
  const [tracker, setTracker] = useState(load)
  const [storageError, setStorageError] = useState(false)
  const key = username.toLowerCase()

  useEffect(() => {
    try {
      window.localStorage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(tracker))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [tracker])

  const setStatus = useCallback((id: AchievementId, status: AchievementState) => {
    setTracker(current => updateAchievementState(current, key, id, status))
  }, [key])
  const summary = useMemo(() => achievementSummary(tracker, key), [tracker, key])
  const statusOf = useCallback((id: AchievementId) => getAchievementState(tracker, key, id), [tracker, key])

  return { summary, statusOf, setStatus, storageError }
}
