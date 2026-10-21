import { describe, expect, it } from 'vitest'
import {
  ACHIEVEMENTS, TRACKABLE_ACHIEVEMENTS, MAX_ACHIEVEMENT_PROFILES,
  achievementSummary, emptyAchievementTracker, getAchievementState,
  parseAchievementTracker, updateAchievementState,
} from './achievements'

const now = Date.parse('2026-10-20T12:00:00Z')

describe('achievement guide', () => {
  it('contains seven trackable badges and two historical badges', () => {
    expect(TRACKABLE_ACHIEVEMENTS).toHaveLength(7)
    expect(ACHIEVEMENTS.filter(a => a.category === 'historical')).toHaveLength(2)
    expect(new Set(ACHIEVEMENTS.map(a => a.id)).size).toBe(ACHIEVEMENTS.length)
  })
  it('does not automatically claim any badge was earned', () => {
    const summary = achievementSummary(emptyAchievementTracker(), 'kobrymoataz')
    expect(summary).toEqual({ earned: 0, working: 0, planned: 7 })
  })
  it('tracks self-reported progress per user (case insensitive)', () => {
    const initial = emptyAchievementTracker()
    const working = updateAchievementState(initial, 'KobryMoataz', 'pull-shark', 'working', now)
    const earned = updateAchievementState(working, 'kobrymoataz', 'pull-shark', 'earned', now + 1000)
    expect(getAchievementState(earned, 'KOBRYMOATAZ', 'pull-shark')).toBe('earned')
    expect(achievementSummary(earned, 'kobrymoataz').earned).toBe(1)
    expect(achievementSummary(earned, 'someoneelse').earned).toBe(0)
  })
  it('supports resetting an achievement to planned without marking other badges', () => {
    const earned = updateAchievementState(emptyAchievementTracker(), 'alice', 'yolo', 'earned', now)
    const reset = updateAchievementState(earned, 'alice', 'yolo', 'planned', now + 1000)
    expect(getAchievementState(reset, 'alice', 'yolo')).toBe('planned')
    expect(reset.profiles.alice).toBeUndefined()
  })
  it('does not allow historical achievements or malformed usernames to be marked', () => {
    const empty = emptyAchievementTracker()
    expect(updateAchievementState(empty, 'bob', 'mars-2020', 'earned', now)).toBe(empty)
    expect(updateAchievementState(empty, '__bad', 'yolo', 'earned', now)).toBe(empty)
  })
  it('parses bounded browser storage without trusting unknown IDs', () => {
    const raw = JSON.stringify({ version: 1, profiles: {
      Alice: { 'yolo': { status: 'earned', updatedAt: now }, 'inject': { status: 'earned', updatedAt: now }, 'quickdraw': { status: 'false', updatedAt: now } },
      '!bad': { 'pull-shark': { status: 'earned', updatedAt: now } },
    } })
    const parsed = parseAchievementTracker(raw)
    expect(parsed.profiles.alice.yolo.status).toBe('earned')
    expect(Object.keys(parsed.profiles.alice)).toEqual(['yolo'])
    expect(parsed.profiles['!bad']).toBeUndefined()
    expect(parseAchievementTracker('{not-json')).toEqual(emptyAchievementTracker())
    expect(parseAchievementTracker('x'.repeat(100_001))).toEqual(emptyAchievementTracker())
  })
  it('limits the number of locally tracked users', () => {
    let data = emptyAchievementTracker()
    for (let i = 0; i < MAX_ACHIEVEMENT_PROFILES; i++) {
      data = updateAchievementState(data, `user${i}`, 'yolo', 'working', now)
    }
    const ignored = updateAchievementState(data, 'one-more', 'yolo', 'earned', now)
    expect(ignored).toBe(data)
  })
  it('does not update an unchanged badge status', () => {
    const initial = emptyAchievementTracker()
    expect(updateAchievementState(initial, 'alice', 'pull-shark', 'planned', now)).toBe(initial)
    const next = updateAchievementState(initial, 'alice', 'pull-shark', 'working', now)
    expect(updateAchievementState(next, 'alice', 'pull-shark', 'working', now + 100)).toBe(next)
  })
})
