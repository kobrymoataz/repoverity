/** Local display preference. It does not override an OS reduced-motion request. */
export const MOTION_STORAGE_KEY = 'repoverity:motion:v1'
export type MotionPreference = 'standard' | 'reduced'

export function parseMotionPreference(value: unknown): MotionPreference {
  return value === 'reduced' ? 'reduced' : 'standard'
}

export function readMotionPreference(storage: Pick<Storage, 'getItem'> | null): MotionPreference {
  if (!storage) return 'standard'
  try { return parseMotionPreference(storage.getItem(MOTION_STORAGE_KEY)) }
  catch { return 'standard' }
}

export function persistMotionPreference(storage: Pick<Storage, 'setItem'> | null, value: MotionPreference): boolean {
  if (!storage) return false
  try { storage.setItem(MOTION_STORAGE_KEY, value); return true }
  catch { return false }
}

export function shouldReduceMotion(preference: MotionPreference, systemReduced: boolean): boolean {
  return systemReduced || preference === 'reduced'
}

/** Durations in seconds. Values stay bounded for a restrained UI. */
export const MOTION_TIMING = Object.freeze({
  hover: 0.14,
  navigate: 0.22,
  exit: 0.13,
  intro: 0.5,
  chart: 0.75,
})
