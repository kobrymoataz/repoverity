import {
  GROWTH_STORAGE_KEY, MAX_GROWTH_POINTS, MAX_TRACKED_PROFILES,
  parseGrowthStore, type GrowthStore,
} from './growth'
import {
  ACHIEVEMENT_STORAGE_KEY, MAX_ACHIEVEMENT_PROFILES,
  parseAchievementTracker, TRACKABLE_ACHIEVEMENTS,
  type AchievementTracker,
} from './achievements'

export const BACKUP_VERSION = 1
export const MAX_BACKUP_BYTES = 2_500_000
const GH_LOGIN = /^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/
const ACHIEVEMENT_IDS = new Set<string>(TRACKABLE_ACHIEVEMENTS.map(item => item.id))

export interface LocalBackup {
  app: 'RepoVerity'
  version: 1
  exportedAt: string
  growth: GrowthStore
  achievements: AchievementTracker
}

/** Minimal interface for testable, atomic localStorage writes. */
export type LocalStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function integer(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function validGrowth(data: unknown): data is GrowthStore {
  if (!record(data) || data.version !== 1 || !record(data.profiles)) return false
  const profiles = Object.entries(data.profiles)
  if (profiles.length > MAX_TRACKED_PROFILES) return false
  return profiles.every(([login, profile]) => {
    if (!GH_LOGIN.test(login) || !record(profile)) return false
    if (typeof profile.enabled !== 'boolean' || !integer(profile.goal) || profile.goal < 1 || profile.goal > 10_000_000) return false
    if (!Array.isArray(profile.points) || profile.points.length > MAX_GROWTH_POINTS) return false
    return profile.points.every(point => record(point)
      && integer(point.at) && point.at >= Date.UTC(2008, 0, 1) && point.at <= 8_640_000_000_000_000
      && integer(point.followers) && integer(point.publicRepos)
      && integer(point.sampleStars) && integer(point.sampleForks)
      && integer(point.sampleSize) && point.sampleSize <= 100)
  })
}

function validAchievements(data: unknown): data is AchievementTracker {
  if (!record(data) || data.version !== 1 || !record(data.profiles)) return false
  const profiles = Object.entries(data.profiles)
  if (profiles.length > MAX_ACHIEVEMENT_PROFILES) return false
  return profiles.every(([login, badges]) => GH_LOGIN.test(login) && record(badges)
    && Object.entries(badges).every(([id, entry]) => ACHIEVEMENT_IDS.has(id)
      && record(entry) && (entry.status === 'planned' || entry.status === 'working' || entry.status === 'earned')
      && integer(entry.updatedAt) && entry.updatedAt >= Date.UTC(2008, 0, 1) && entry.updatedAt <= 8_640_000_000_000_000))
}

/** A portable JSON backup, containing only the two keys created by this app. */
export function buildLocalBackup(storage: LocalStore, now = new Date()): LocalBackup {
  return {
    app: 'RepoVerity', version: BACKUP_VERSION, exportedAt: now.toISOString(),
    growth: parseGrowthStore(storage.getItem(GROWTH_STORAGE_KEY)),
    achievements: parseAchievementTracker(storage.getItem(ACHIEVEMENT_STORAGE_KEY)),
  }
}

/** Refuse unknown formats and oversized files rather than silently deleting history. */
export function parseLocalBackup(raw: string): LocalBackup {
  if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('Backup exceeds the 2.5 MB limit.')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('Select a valid RepoVerity JSON backup.') }
  if (!record(parsed) || parsed.app !== 'RepoVerity' || parsed.version !== BACKUP_VERSION || typeof parsed.exportedAt !== 'string') {
    throw new Error('Unsupported backup format or version.')
  }
  if (!validGrowth(parsed.growth) || !validAchievements(parsed.achievements)) {
    throw new Error('Backup contains invalid or unsupported tracking data.')
  }
  return {
    app: 'RepoVerity', version: BACKUP_VERSION,
    exportedAt: parsed.exportedAt,
    growth: parseGrowthStore(JSON.stringify(parsed.growth)),
    achievements: parseAchievementTracker(JSON.stringify(parsed.achievements)),
  }
}

export function localBackupSummary(backup: LocalBackup) {
  const profiles = Object.values(backup.growth.profiles)
  const observations = profiles.reduce((sum, profile) => sum + profile.points.length, 0)
  const badges = Object.values(backup.achievements.profiles)
    .reduce((sum, entries) => sum + Object.values(entries).filter(entry => entry.status === 'earned').length, 0)
  return { profiles: profiles.length, observations, achievements: Object.keys(backup.achievements.profiles).length, selfReportedBadges: badges }
}

/** Restore both keys or make a best-effort rollback on storage quota/permission failure. */
export function restoreLocalBackup(storage: LocalStore, backup: LocalBackup) {
  const normalized = parseLocalBackup(JSON.stringify(backup))
  const oldGrowth = storage.getItem(GROWTH_STORAGE_KEY)
  const oldAchievements = storage.getItem(ACHIEVEMENT_STORAGE_KEY)
  try {
    storage.setItem(GROWTH_STORAGE_KEY, JSON.stringify(normalized.growth))
    storage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(normalized.achievements))
  } catch {
    try {
      if (oldGrowth === null) storage.removeItem(GROWTH_STORAGE_KEY)
      else storage.setItem(GROWTH_STORAGE_KEY, oldGrowth)
      if (oldAchievements === null) storage.removeItem(ACHIEVEMENT_STORAGE_KEY)
      else storage.setItem(ACHIEVEMENT_STORAGE_KEY, oldAchievements)
    } catch { /* Browser storage can be unavailable; do not claim success. */ }
    throw new Error('Browser storage is unavailable or full. Your backup was not imported.')
  }
}

export function clearLocalData(storage: LocalStore) {
  storage.removeItem(GROWTH_STORAGE_KEY)
  storage.removeItem(ACHIEVEMENT_STORAGE_KEY)
}
