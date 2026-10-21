import { describe, expect, it } from 'vitest'
import {
  analyticsCsvCell, lastPushDistribution, portfolioAnalytics, portfolioAnalyticsCsv,
  publishedReleaseIntervalDays, type ReleaseSummary,
} from './developerAnalytics'
import type { GitHubRepository, GitHubSnapshot } from '../types/github'

const repo: GitHubRepository = {
  id: 1, name: 'a', full_name: 'team/a', html_url: 'https://github.com/team/a', description: null,
  language: 'TypeScript', stargazers_count: 12, forks_count: 2, topics: [], license: null,
  archived: false, fork: false, pushed_at: '2026-10-20T00:00:00Z', updated_at: '2026-10-20T00:00:00Z', homepage: null,
}
const snapshot: GitHubSnapshot = {
  fetchedAt: Date.parse('2026-10-21T00:00:00Z'),
  user: { id: 23, login: 'team', name: 'Team', avatar_url: '', html_url: 'https://github.com/team', bio: null,
    company: null, location: null, blog: '', followers: 42, following: 4, public_repos: 300, created_at: '2020-01-01T00:00:00Z' },
  repositories: [repo, { ...repo, id: 2, name: 'b', full_name: 'team/b', language: null, fork: true,
    stargazers_count: 8, forks_count: 0, pushed_at: '2026-09-05T00:00:00Z' }],
}
const now = Date.parse('2026-10-21T00:00:00Z')

describe('portfolio analytics with honest scope', () => {
  it('uses GitHub account counts separately from repository samples', () => {
    const data = portfolioAnalytics(snapshot, now)
    expect(data.followers).toBe(42)
    expect(data.publicRepositories).toBe(300)
    expect(data.sampleSize).toBe(2)
    expect(data.starsInSample).toBe(20)
    expect(data.active30).toBe(1)
    expect(data.active90).toBe(2)
    expect(data.originalRepositories).toBe(1)
    expect(data.coveragePercent).toBe(1)
  })
  it('counts most recent push dates, never claims to count commits', () => {
    const distribution = lastPushDistribution(snapshot.repositories, now)
    expect(distribution).toHaveLength(6)
    expect(distribution.at(-1)?.key).toBe('2026-10')
    expect(distribution.at(-1)?.count).toBe(1)
    expect(distribution.at(-2)?.count).toBe(1)
  })
  it('ignores future dates, invalid timestamps, and older dates', () => {
    const list = [
      { ...repo, pushed_at: '2027-10-20T00:00:00Z' },
      { ...repo, pushed_at: 'not a date' },
      { ...repo, pushed_at: '2025-10-20T00:00:00Z' },
    ]
    expect(lastPushDistribution(list, now).every(bucket => bucket.count === 0)).toBe(true)
  })
  it('handles zero total safely', () => {
    const empty = portfolioAnalytics({ ...snapshot, repositories: [], user: { ...snapshot.user, public_repos: 0 } }, now)
    expect(empty.coveragePercent).toBe(0)
    expect(empty.mostStarred).toEqual([])
  })
  it('escapes csv formula injection and quotes', () => {
    expect(analyticsCsvCell('=IMPORTXML("x")')).toBe('"\'=IMPORTXML(""x"")"')
    expect(analyticsCsvCell(' normal')).toBe('" normal"')
    expect(portfolioAnalyticsCsv(portfolioAnalytics(snapshot, now))).toContain('"Stars (sample only)","20"')
  })
  it('calculates a median publication interval for published stable releases', () => {
    const base = (tag: string, date: string, prerelease = false): ReleaseSummary =>
      ({ id: 1, tag_name: tag, name: tag, published_at: date, prerelease, html_url: '' })
    const releases = [base('v3', '2026-10-16'), base('v2', '2026-10-06'), base('v1', '2026-09-26'), base('rc', '2026-10-20', true)]
    expect(publishedReleaseIntervalDays(releases)).toBe(10)
    expect(publishedReleaseIntervalDays(releases.slice(0, 1))).toBe(null)
  })
})
