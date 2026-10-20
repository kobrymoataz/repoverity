import { describe, expect, it } from 'vitest'
import {
  compareGrowth, DEFAULT_FOLLOWER_GOAL, emptyGrowthStore, getGrowthProfile,
  growthCsv, parseGrowthStore, pointFromSnapshot, recordGrowthPoint,
  removeGrowthHistory, selectGrowthRange, setFollowerGoal, setGrowthTracking,
  MAX_GROWTH_POINTS,
} from './growth'
import type { GitHubSnapshot } from '../types/github'

const day = (iso: string) => Date.parse(iso)
const observation = (iso: string, followers: number, stars = 2) => ({
  at: day(iso), followers, publicRepos: 3, sampleStars: stars, sampleForks: 1, sampleSize: 2,
})
const a = observation('2026-10-18T11:00:00.000Z', 100, 5)
const b = observation('2026-10-20T12:00:00.000Z', 110, 8)

function tracking() { return setGrowthTracking(emptyGrowthStore(), 'kobrymoataz', true) }

describe('local growth history', () => {
  it('starts empty, opt-in only, with a 1,000 follower goal', () => {
    const store = emptyGrowthStore()
    expect(getGrowthProfile(store, 'kobrymoataz')).toEqual({enabled: false, goal: DEFAULT_FOLLOWER_GOAL, points: []})
    expect(recordGrowthPoint(store, 'kobrymoataz', a)).toBe(store)
  })

  it('isolates profiles by case-insensitive GitHub login', () => {
    const saved = recordGrowthPoint(tracking(), 'KobryMoataz', a)
    expect(getGrowthProfile(saved, 'kobrymoataz').points).toHaveLength(1)
    expect(getGrowthProfile(saved, 'someoneelse').points).toHaveLength(0)
  })

  it('records one point per UTC date, replacing with the latest genuine fetch', () => {
    const first = recordGrowthPoint(tracking(), 'kobrymoataz', a)
    const newer = {...a, at: day('2026-10-18T20:00:00Z'), followers: 105}
    const updated = recordGrowthPoint(first, 'kobrymoataz', newer)
    expect(getGrowthProfile(updated, 'kobrymoataz').points).toEqual([newer])
    expect(recordGrowthPoint(updated, 'kobrymoataz', a)).toBe(updated)
    expect(recordGrowthPoint(updated, 'kobrymoataz', newer)).toBe(updated)
  })

  it('treats midnight UTC as a new observation day', () => {
    const before = observation('2026-10-20T23:59:59.000Z', 42)
    const after = observation('2026-10-21T00:00:01.000Z', 43)
    const store = recordGrowthPoint(recordGrowthPoint(setGrowthTracking(emptyGrowthStore(), 'test', true), 'test', before), 'test', after)
    expect(getGrowthProfile(store, 'test').points).toHaveLength(2)
  })

  it('does not record while paused and resumes without removing prior data', () => {
    const saved = recordGrowthPoint(setGrowthTracking(emptyGrowthStore(), 'test', true), 'test', a)
    const paused = setGrowthTracking(saved, 'test', false)
    expect(recordGrowthPoint(paused, 'test', b)).toBe(paused)
    expect(getGrowthProfile(setGrowthTracking(paused, 'test', true), 'test').points).toHaveLength(1)
  })

  it('supports goals and ignores invalid values', () => {
    const store = setFollowerGoal(tracking(), 'test', 5000)
    expect(getGrowthProfile(store, 'test').goal).toBe(5000)
    expect(setFollowerGoal(store, 'test', -1)).toBe(store)
    expect(setFollowerGoal(store, 'test', 1.5)).toBe(store)
  })

  it('calculates only observed changes and keeps declines negative', () => {
    expect(compareGrowth([a])).toBeNull()
    const comparison = compareGrowth([b, a])!
    expect(comparison.followerDelta).toBe(10)
    expect(comparison.sampleStarDelta).toBe(3)
    expect(compareGrowth([a, {...b, followers: 90}])?.followerDelta).toBe(-10)
  })

  it('does not claim a trend for two readings on the same day', () => {
    expect(compareGrowth([a, {...a, at: a.at + 5000, followers: 111}])).toBeNull()
  })

  it('filters 7D / 30D using real timestamps only', () => {
    const old = observation('2026-08-01T00:00:00Z', 80)
    const now = day('2026-10-21T00:00:00Z')
    expect(selectGrowthRange([old, a, b], '7d', now)).toHaveLength(2)
    expect(selectGrowthRange([old, a, b], '30d', now)).toHaveLength(2)
    expect(selectGrowthRange([old, a, b], 'all', now)).toHaveLength(3)
  })

  it('handles corrupted and oversized storage safely', () => {
    expect(parseGrowthStore('not json')).toEqual(emptyGrowthStore())
    expect(parseGrowthStore('x'.repeat(2_000_001))).toEqual(emptyGrowthStore())
    expect(parseGrowthStore(JSON.stringify({version:1, profiles:{bad:{enabled: true,goal:-3,points:[{at: 1}]}}})).profiles.bad.points).toEqual([])
  })

  it('removes only the selected profile history', () => {
    const first = recordGrowthPoint(setGrowthTracking(emptyGrowthStore(), 'test', true), 'test', a)
    const second = recordGrowthPoint(setGrowthTracking(first, 'other', true), 'other', b)
    const cleared = removeGrowthHistory(second, 'test')
    expect(getGrowthProfile(cleared,'test').points).toHaveLength(0)
    expect(getGrowthProfile(cleared,'other').points).toHaveLength(1)
  })

  it('exports UTC CSV observations without invented dates', () => {
    const csv = growthCsv('kobrymoataz', [b,a])
    const lines = csv.trim().split('\r\n')
    expect(lines).toHaveLength(3)
    expect(lines[0]).toContain('sampled_stars')
    expect(lines[1]).toContain('2026-10-18,2026-10-18T11:00:00.000Z,kobrymoataz,100')
  })

  it('limits stored observations to the latest 365 days of observation', () => {
    let store = tracking()
    for (let i = 0; i < MAX_GROWTH_POINTS + 3; i++) {
      store = recordGrowthPoint(store, 'kobrymoataz', observation(new Date(Date.UTC(2025, 0, 1 + i)).toISOString(), i))
    }
    const values = getGrowthProfile(store,'kobrymoataz').points
    expect(values).toHaveLength(MAX_GROWTH_POINTS)
    expect(values[0].followers).toBe(3)
  })

  it('converts API values into the explicitly sampled metrics', () => {
    const snapshot = {
      fetchedAt: b.at,
      user: { login: 'dev', followers: 50, public_repos: 7 },
      repositories: [
        { stargazers_count: 4, forks_count: 1 },
        { stargazers_count: 9, forks_count: 2 },
      ],
    } as GitHubSnapshot
    expect(pointFromSnapshot(snapshot)).toEqual({at:b.at,followers:50, publicRepos:7,sampleStars:13,sampleForks:3,sampleSize:2})
  })
})
