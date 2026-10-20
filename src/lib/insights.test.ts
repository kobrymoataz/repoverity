import { describe, expect, it } from 'vitest'
import { GithubApiError, normalizeUsername } from './github'
import { activeWithinDays, calculateInsights, filterRepositories, percentage } from './insights'
import type { GitHubRepository } from '../types/github'

const base: GitHubRepository = {
  id: 1,
  name: 'example',
  full_name: 'dev/example',
  html_url: 'https://github.com/dev/example',
  description: 'A documented sample',
  language: 'TypeScript',
  stargazers_count: 12,
  forks_count: 4,
  topics: ['typescript', 'developer-tools'],
  license: { key: 'mit', name: 'MIT License' },
  archived: false,
  fork: false,
  pushed_at: '2026-10-15T00:00:00Z',
  updated_at: '2026-10-15T00:00:00Z',
  homepage: null,
}
const now = Date.parse('2026-10-20T12:00:00Z')

describe('GitHub username normalization', () => {
  it('accepts usernames, @mentions, and profile URLs', () => {
    expect(normalizeUsername('  @kobrymoataz  ')).toBe('kobrymoataz')
    expect(normalizeUsername('https://github.com/torvalds/')).toBe('torvalds')
    expect(normalizeUsername('www')).toBe('www')
  })
  it('rejects repositories, non-GitHub hosts and malformed names', () => {
    for (const value of ['https://github.com/dev/repo', 'https://github.com.evil.test/dev', '-bad', 'hello world', '']) {
      expect(() => normalizeUsername(value)).toThrow(GithubApiError)
    }
  })
})

describe('repository insights', () => {
  it('reports sampled stars, forks, metadata coverage and language counts', () => {
    const repos = [base, { ...base, id: 2, name: 'plain', stargazers_count: 3, forks_count: 1, description: null, topics: [], language: null, license: null, pushed_at: '2025-01-01T00:00:00Z' }]
    const result = calculateInsights(repos, now)
    expect(result.stars).toBe(15)
    expect(result.forks).toBe(5)
    expect(result.active90Days).toBe(1)
    expect(result.languages[0].count).toBe(1)
    expect(result.signals.map(item => item.value)).toEqual([50, 50, 50, 50])
  })
  it('handles empty samples safely', () => {
    expect(calculateInsights([], now).stars).toBe(0)
    expect(percentage(3, 0)).toBe(0)
  })
  it('matches recent activity without marking future dates active', () => {
    expect(activeWithinDays(base, 90, now)).toBe(true)
    expect(activeWithinDays({...base, pushed_at: '2027-01-01T00:00:00Z'}, 90, now)).toBe(false)
  })
  it('supports filters, text search and sorting', () => {
    const repos = [base, {...base, id: 2, name: 'old', language: 'Python', topics: ['python'], stargazers_count: 0, pushed_at: '2025-01-01T00:00:00Z'}]
    expect(filterRepositories(repos, 'typescript', 'all', 'stars', now).map(repo => repo.name)).toEqual(['example'])
    expect(filterRepositories(repos, '', 'starred', 'stars', now)).toHaveLength(1)
    expect(filterRepositories(repos, '', 'active', 'recent', now)).toHaveLength(1)
  })
})
