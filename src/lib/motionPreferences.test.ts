import { describe, expect, it } from 'vitest'
import {
  MOTION_STORAGE_KEY, MOTION_TIMING, parseMotionPreference,
  persistMotionPreference, readMotionPreference, shouldReduceMotion,
} from './motionPreferences'

describe('motion policy', () => {
  it('defaults to standard for unknown or missing preferences', () => {
    expect(parseMotionPreference(null)).toBe('standard')
    expect(parseMotionPreference('full')).toBe('standard')
    expect(parseMotionPreference('reduced')).toBe('reduced')
    expect(readMotionPreference(null)).toBe('standard')
  })
  it('always respects operating system reduced motion', () => {
    expect(shouldReduceMotion('standard', true)).toBe(true)
    expect(shouldReduceMotion('reduced', false)).toBe(true)
    expect(shouldReduceMotion('standard', false)).toBe(false)
  })
  it('writes only the designated local preference', () => {
    const records = new Map<string,string>()
    const store = {
      getItem: (key: string) => records.get(key) ?? null,
      setItem: (key: string, value: string) => { records.set(key, value) },
    }
    expect(persistMotionPreference(store, 'reduced')).toBe(true)
    expect(readMotionPreference(store)).toBe('reduced')
    expect(records.size).toBe(1)
    expect(records.get(MOTION_STORAGE_KEY)).toBe('reduced')
  })
  it('fails safely when browser storage is blocked', () => {
    const store = {
      getItem: (_key: string): string | null => { throw new Error('blocked') },
      setItem: (_key: string, _value: string): void => { throw new Error('blocked') },
    }
    expect(readMotionPreference(store)).toBe('standard')
    expect(persistMotionPreference(store, 'reduced')).toBe(false)
  })
  it('keeps durations short and finite', () => {
    for (const duration of Object.values(MOTION_TIMING)) {
      expect(Number.isFinite(duration)).toBe(true)
      expect(duration).toBeGreaterThan(0)
      expect(duration).toBeLessThanOrEqual(0.8)
    }
  })
})
