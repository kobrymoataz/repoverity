import { useCallback, useEffect, useState } from 'react'
import {
  readMotionPreference, persistMotionPreference, shouldReduceMotion,
  type MotionPreference,
} from '../lib/motionPreferences'

const QUERY = '(prefers-reduced-motion: reduce)'

function initialSystemPreference(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(QUERY).matches
    : false
}

function safeStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try { return window.localStorage } catch { return null }
}

export function useMotionPreference() {
  const [preference, setPreference] = useState<MotionPreference>(() => readMotionPreference(safeStorage()))
  const [systemReduced, setSystemReduced] = useState(initialSystemPreference)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(QUERY)
    const onChange = (event: MediaQueryListEvent) => setSystemReduced(event.matches)
    setSystemReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const reduceMotion = shouldReduceMotion(preference, systemReduced)
  useEffect(() => { document.documentElement.dataset.rvMotion = reduceMotion ? 'reduced' : 'standard' }, [reduceMotion])

  const toggle = useCallback(() => {
    setPreference(current => {
      const next: MotionPreference = current === 'standard' ? 'reduced' : 'standard'
      if (!persistMotionPreference(safeStorage(), next)) setStorageError(true)
      else setStorageError(false)
      return next
    })
  }, [])

  return { reduceMotion, preference, systemReduced, storageError, toggle }
}
