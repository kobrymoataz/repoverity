import { describe, expect, it } from 'vitest'
import { ACHIEVEMENT_STORAGE_KEY } from './achievements'
import { GROWTH_STORAGE_KEY } from './growth'
import {
  buildLocalBackup, clearLocalData, localBackupSummary, MAX_BACKUP_BYTES,
  parseLocalBackup, restoreLocalBackup, type LocalStore,
} from './portability'

function mockStorage(initial: Record<string, string> = {}) {
  const saved = new Map(Object.entries(initial))
  const storage: LocalStore = {
    getItem: key => saved.get(key) ?? null,
    setItem: (key, value) => { saved.set(key, value) },
    removeItem: key => { saved.delete(key) },
  }
  return { storage, saved }
}

const exampleGrowth = {
  version: 1, profiles: {
    alice: { enabled: true, goal: 1000, points: [{
      at: Date.parse('2026-10-21T12:00:00Z'), followers: 40, publicRepos: 3,
      sampleStars: 6, sampleForks: 1, sampleSize: 3,
    }] },
  },
} as const
const exampleAchievements = {
  version: 1, profiles: {
    alice: { 'pull-shark': { status: 'earned', updatedAt: Date.parse('2026-10-21T12:00:00Z') } },
  },
} as const

function validBackup() {
  return JSON.stringify({
    app: 'RepoVerity', version: 1, exportedAt: '2026-10-21T12:00:00.000Z',
    growth: exampleGrowth, achievements: exampleAchievements,
  })
}

describe('versioned browser-local backups', () => {
  it('exports both local stores without adding secret tokens', () => {
    const { storage } = mockStorage({
      [GROWTH_STORAGE_KEY]: JSON.stringify(exampleGrowth),
      [ACHIEVEMENT_STORAGE_KEY]: JSON.stringify(exampleAchievements),
      'some-private-api-token': 'never-export-this',
    })
    const backup = buildLocalBackup(storage, new Date('2026-10-21T12:00:00Z'))
    expect(backup.app).toBe('RepoVerity')
    expect(backup.version).toBe(1)
    expect(JSON.stringify(backup)).not.toContain('never-export-this')
    expect(localBackupSummary(backup)).toEqual({ profiles: 1, observations: 1, achievements: 1, selfReportedBadges: 1 })
  })
  it('round-trips growth observations and self-reported badges', () => {
    const { storage } = mockStorage()
    restoreLocalBackup(storage, parseLocalBackup(validBackup()))
    const backup = buildLocalBackup(storage)
    expect(backup.growth.profiles.alice.points[0].followers).toBe(40)
    expect(backup.achievements.profiles.alice['pull-shark'].status).toBe('earned')
  })
  it('refuses malformed, oversized or outdated backups', () => {
    for (const raw of [
      '{', '{}', JSON.stringify({ ...JSON.parse(validBackup()), version: 999 }),
      JSON.stringify({ ...JSON.parse(validBackup()), growth: { version: 1, profiles: { alice: { enabled: true, goal: 0, points: [] } } } }),
      JSON.stringify({ ...JSON.parse(validBackup()), achievements: { version: 1, profiles: { alice: { 'not-a-badge': { status: 'earned', updatedAt: 2000000000000 } } } } }),
      ' '.repeat(MAX_BACKUP_BYTES + 1),
    ]) expect(() => parseLocalBackup(raw)).toThrow()
  })
  it('keeps unrelated local storage on deletion', () => {
    const { storage, saved } = mockStorage({ [GROWTH_STORAGE_KEY]: '{}', [ACHIEVEMENT_STORAGE_KEY]: '{}', other: 'safe' })
    clearLocalData(storage)
    expect(saved.has(GROWTH_STORAGE_KEY)).toBe(false)
    expect(saved.has(ACHIEVEMENT_STORAGE_KEY)).toBe(false)
    expect(saved.get('other')).toBe('safe')
  })
  it('rolls back both stores when a write fails', () => {
    const { storage, saved } = mockStorage({ [GROWTH_STORAGE_KEY]: 'old-growth', [ACHIEVEMENT_STORAGE_KEY]: 'old-achievements' })
    const failing: LocalStore = {
      ...storage,
      setItem: (key, value) => {
        if (key === ACHIEVEMENT_STORAGE_KEY && value !== 'old-achievements') throw new Error('Quota')
        storage.setItem(key, value)
      },
    }
    expect(() => restoreLocalBackup(failing, parseLocalBackup(validBackup()))).toThrow()
    expect(saved.get(GROWTH_STORAGE_KEY)).toBe('old-growth')
    expect(saved.get(ACHIEVEMENT_STORAGE_KEY)).toBe('old-achievements')
  })
})
