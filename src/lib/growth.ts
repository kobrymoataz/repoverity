import type { GitHubSnapshot } from '../types/github'

/** Growth history is local-only and contains observations, never inferred history. */
export const GROWTH_STORAGE_KEY = 'repoverity:growth:v1'
export const DEFAULT_FOLLOWER_GOAL = 1000
export const MAX_GROWTH_POINTS = 365
export const MAX_TRACKED_PROFILES = 25
const DAY_MS = 86_400_000
const LOGIN = /^(?!-)[a-zA-Z0-9-]{1,39}(?<!-)$/

export type GrowthMetric = 'followers' | 'sampleStars'
export type GrowthRange = '7d' | '30d' | 'all'

export interface GrowthPoint {
  at: number
  followers: number
  publicRepos: number
  sampleStars: number
  sampleForks: number
  sampleSize: number
}

export interface GrowthProfile {
  enabled: boolean
  goal: number
  points: GrowthPoint[]
}

export interface GrowthStore {
  version: 1
  profiles: Record<string, GrowthProfile>
}

const emptyProfile = (): GrowthProfile => ({ enabled: false, goal: DEFAULT_FOLLOWER_GOAL, points: [] })
export const emptyGrowthStore = (): GrowthStore => ({ version: 1, profiles: {} })

function validNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function validGoal(value: unknown): value is number {
  return validNumber(value) && value >= 1 && value <= 10_000_000
}

function validPoint(value: unknown): value is GrowthPoint {
  if (!value || typeof value !== 'object') return false
  const point = value as Partial<GrowthPoint>
  return validNumber(point.at) && point.at >= Date.UTC(2008, 0, 1)
    && point.at <= 8_640_000_000_000_000
    && validNumber(point.followers) && validNumber(point.publicRepos)
    && validNumber(point.sampleStars) && validNumber(point.sampleForks)
    && validNumber(point.sampleSize) && point.sampleSize <= 100
}

function utcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10)
}

function normalizedPoints(points: GrowthPoint[]): GrowthPoint[] {
  const byDay = new Map<string, GrowthPoint>()
  for (const point of [...points].sort((a, b) => a.at - b.at)) {
    const day = utcDay(point.at)
    const previous = byDay.get(day)
    if (!previous || point.at >= previous.at) byDay.set(day, point)
  }
  return [...byDay.values()].sort((a, b) => a.at - b.at).slice(-MAX_GROWTH_POINTS)
}

/** Malformed local browser data is ignored, not executed or trusted. */
export function parseGrowthStore(raw: string | null): GrowthStore {
  if (!raw || raw.length > 2_000_000) return emptyGrowthStore()
  try {
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== 'object') return emptyGrowthStore()
    const parsed = value as Partial<GrowthStore>
    if (parsed.version !== 1 || !parsed.profiles || typeof parsed.profiles !== 'object' || Array.isArray(parsed.profiles)) {
      return emptyGrowthStore()
    }
    const profiles: Record<string, GrowthProfile> = {}
    for (const [name, profile] of Object.entries(parsed.profiles).slice(0, MAX_TRACKED_PROFILES)) {
      if (!LOGIN.test(name) || !profile || typeof profile !== 'object') continue
      const candidate = profile as Partial<GrowthProfile>
      const points = Array.isArray(candidate.points) ? candidate.points.filter(validPoint).slice(-MAX_GROWTH_POINTS * 2) : []
      profiles[name.toLowerCase()] = {
        enabled: candidate.enabled === true,
        goal: validGoal(candidate.goal) ? candidate.goal : DEFAULT_FOLLOWER_GOAL,
        points: normalizedPoints(points),
      }
    }
    return { version: 1, profiles }
  } catch {
    return emptyGrowthStore()
  }
}

export function getGrowthProfile(store: GrowthStore, username: string): GrowthProfile {
  return store.profiles[username.toLowerCase()] ?? emptyProfile()
}

function updateProfile(store: GrowthStore, username: string, updater: (profile: GrowthProfile) => GrowthProfile): GrowthStore {
  if (!LOGIN.test(username)) return store
  const key = username.toLowerCase()
  const present = store.profiles[key]
  if (!present && Object.keys(store.profiles).length >= MAX_TRACKED_PROFILES) return store
  const next = updater(present ?? emptyProfile())
  if (present === next) return store
  return { version: 1, profiles: { ...store.profiles, [key]: next } }
}

export function setGrowthTracking(store: GrowthStore, username: string, enabled: boolean): GrowthStore {
  return updateProfile(store, username, profile => profile.enabled === enabled ? profile : { ...profile, enabled })
}

export function setFollowerGoal(store: GrowthStore, username: string, goal: number): GrowthStore {
  if (!validGoal(goal)) return store
  return updateProfile(store, username, profile => profile.goal === goal ? profile : { ...profile, goal })
}

export function removeGrowthHistory(store: GrowthStore, username: string): GrowthStore {
  const key = username.toLowerCase()
  if (!Object.prototype.hasOwnProperty.call(store.profiles, key)) return store
  const profiles = { ...store.profiles }
  delete profiles[key]
  return { version: 1, profiles }
}

/** Stars/forks are sampled from up to 100 recently updated owned public repos. */
export function pointFromSnapshot(snapshot: GitHubSnapshot): GrowthPoint {
  return {
    at: snapshot.fetchedAt,
    followers: snapshot.user.followers,
    publicRepos: snapshot.user.public_repos,
    sampleStars: snapshot.repositories.reduce((sum, repo) => sum + repo.stargazers_count, 0),
    sampleForks: snapshot.repositories.reduce((sum, repo) => sum + repo.forks_count, 0),
    sampleSize: snapshot.repositories.length,
  }
}

/** Replace same-UTC-day observations with the newest real API result. */
export function recordGrowthPoint(store: GrowthStore, username: string, point: GrowthPoint): GrowthStore {
  if (!validPoint(point) || !store.profiles[username.toLowerCase()]?.enabled) return store
  return updateProfile(store, username, profile => {
    if (!profile.enabled) return profile
    const day = utcDay(point.at)
    const prior = profile.points.find(entry => utcDay(entry.at) === day)
    if (prior && prior.at > point.at) return profile
    if (prior && Object.keys(point).every(key => point[key as keyof GrowthPoint] === prior[key as keyof GrowthPoint])) {
      return profile
    }
    return { ...profile, points: normalizedPoints([...profile.points.filter(entry => utcDay(entry.at) !== day), point]) }
  })
}

export function selectGrowthRange(points: GrowthPoint[], range: GrowthRange, now = Date.now()): GrowthPoint[] {
  const lower = range === '7d' ? now - 7 * DAY_MS : range === '30d' ? now - 30 * DAY_MS : -Infinity
  return points.filter(point => point.at >= lower && point.at <= now).sort((a, b) => a.at - b.at)
}

export interface GrowthComparison {
  first: GrowthPoint
  last: GrowthPoint
  followerDelta: number
  sampleStarDelta: number
  elapsedDays: number
}

/** Delta only exists when there are observations on at least two UTC dates. */
export function compareGrowth(points: GrowthPoint[]): GrowthComparison | null {
  if (points.length < 2) return null
  const sorted = [...points].sort((a, b) => a.at - b.at)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (utcDay(first.at) === utcDay(last.at)) return null
  return {
    first,
    last,
    followerDelta: last.followers - first.followers,
    sampleStarDelta: last.sampleStars - first.sampleStars,
    elapsedDays: (last.at - first.at) / DAY_MS,
  }
}

export function growthCsv(username: string, points: GrowthPoint[]): string {
  const header = 'utc_date,recorded_at_utc,github_username,followers,public_repositories,sampled_stars,sampled_forks,sampled_repositories'
  if (!LOGIN.test(username)) return `${header}\r\n`
  const lines = [...points].sort((a, b) => a.at - b.at).filter(validPoint).map(point => [
    utcDay(point.at), new Date(point.at).toISOString(), username,
    point.followers, point.publicRepos, point.sampleStars, point.sampleForks, point.sampleSize,
  ].join(','))
  return [header, ...lines].join('\r\n') + '\r\n'
}
